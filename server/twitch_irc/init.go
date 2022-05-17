package twitch_irc

import (
	"errors"
	"fmt"
	"log"
	"regexp"
	"strings"

	"github.com/imoliwer/sound-point-twitch-bot/server/app"
	"github.com/imoliwer/sound-point-twitch-bot/server/util"
	"golang.org/x/net/websocket"
)

const (
	CAP_COMMANDS   = "twitch.tv/commands"
	CAP_TAGS       = "twitch.tv/tags"
	CAP_MEMBERSHIP = "twitch.tv/membership"
)

var client_join_regex *regexp.Regexp
var client_part_regex *regexp.Regexp
var privmsg_regex = *regexp.MustCompile(`(?m)^(.+):(.+)!(.+)@(.+)\.tmi\.twitch\.tv PRIVMSG #(.+) :(.+)$`)

type Client struct {
	connection *websocket.Conn
	channels   map[string]bool
	onMessage  func(client *Client, state *TwitchMessageState)
}

func NewClient() Client {
	return Client{
		connection: nil,
		channels:   map[string]bool{},
		onMessage:  func(client *Client, state *TwitchMessageState) {},
	}
}

func (r *Client) Listen(app *app.Application) {
	botSettings := app.Settings.Bot
	connection, err := websocket.Dial("ws://irc-ws.chat.twitch.tv:80", "", "http://twitch.tv:80/")

	if err != nil {
		panic(err)
	}

	// assign the connection and notify
	log.Println("Established a connection to the Twitch IRC.")
	r.connection = connection

	// handle receiving data
	r.StartReading(app)

	// enforce lowercase on nick
	nick := strings.ToLower(botSettings.Name)

	// assign the regex(es) dependant on the nick
	client_join_regex = regexp.MustCompile(fmt.Sprintf(`(?m)^:%[1]s!%[1]s@%[1]s\.tmi\.twitch\.tv JOIN #(.+)$`, nick))
	client_part_regex = regexp.MustCompile(fmt.Sprintf(`(?m)^:%[1]s!%[1]s@%[1]s\.tmi\.twitch\.tv PART #(.+)$`, nick))

	// forward the nick and pass
	util.SendMultipleString(
		connection,
		[]util.FormatableString{
			util.NewFormatableString("PASS %s", botSettings.AuthToken),
			util.NewFormatableString("NICK %s", nick),
			util.NewFormatableString("CAP REQ :%s %s %s", CAP_COMMANDS, CAP_TAGS, CAP_MEMBERSHIP),
		},
	)
}

func (r *Client) Join(channel string) (bool, error) {
	return r.join_or_part(channel, true)
}

func (r *Client) Part(channel string) (bool, error) {
	return r.join_or_part(channel, false)
}

func (r *Client) join_or_part(channel string, join bool) (bool, error) {
	conn := r.connection
	if conn == nil {
		return false, errors.New("not connected to to the irc server")
	}

	lowercased := strings.ToLower(channel)
	hasJoined := r.HasJoined(lowercased)

	if join {
		if hasJoined {
			return false, errors.New(fmt.Sprintf("already joined the channel %s", channel))
		}
		util.SendString(conn, "JOIN #%s", lowercased)
		r.channels[lowercased] = true
	} else {
		if !hasJoined {
			return false, errors.New(fmt.Sprintf("not a part of the channel %s", channel))
		}
		util.SendString(conn, "PART #%s", lowercased)
		delete(r.channels, lowercased)
	}
	return true, nil
}

func (r *Client) HasJoined(channel string) bool {
	return r.channels[strings.ToLower(channel)]
}

func (r *Client) Stop() {
	conn := r.connection
	if conn == nil {
		return
	}
	conn.Close()
	r.connection = nil
}

func (r *Client) StartReading(app *app.Application) {
	go func(connection *websocket.Conn) {
		for {
			var data string

			if err := websocket.Message.Receive(connection, &data); err != nil {
				r.Stop()
				break
			}

			if data == "PING :tmi.twitch.tv" {
				util.SendString(connection, "PONG :tmi.twitch.tv")
				continue
			}

			r.handle_message(app, connection, data)
		}
	}(r.connection)
}

func (r *Client) handle_message(
	app *app.Application,
	connection *websocket.Conn,
	data string,
) {
	// check out redemptions (USERNOTICE) etc etc...
	log.Println("-----------------------")
	log.Println(data)
	log.Println("-----------------------")

	if matches := client_join_regex.FindStringSubmatch(data); len(matches) > 0 {
		log.Println(fmt.Sprintf("Joined channel >> %[1]s", matches[1]))
		return
	}

	if matches := client_part_regex.FindStringSubmatch(data); len(matches) > 0 {
		log.Println(fmt.Sprintf("Parted from channel >> %[1]s", matches[1]))
		return
	}

	if matches := privmsg_regex.FindStringSubmatch(data); len(matches) > 0 {
		//messageState := twitch_irc.ProcessMessageState(matches)
		return
	}
}
