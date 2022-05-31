package sound

import (
	"errors"
	"fmt"
	"net/http"
	"os"
	"strings"

	"github.com/gin-gonic/gin"
	"github.com/imoliwer/sound-point-twitch-bot/server/app"
	"github.com/imoliwer/sound-point-twitch-bot/server/util"
)

func checkAndCreatePath() {
	if _, err := os.Stat("audio"); errors.Is(err, os.ErrNotExist) {
		os.Mkdir("audio", os.ModeDir)
	}
}

func WithCORSAndRecovery(engine *gin.Engine) *gin.Engine {
	engine.Use(
		func(ctx *gin.Context) {
			ctx.Writer.Header().Set("Access-Control-Allow-Origin", "*")
			ctx.Writer.Header().Set("Access-Control-Allow-Headers", "Content-Type, Content-Length, Accept-Encoding, X-CSRF-Token, Authorization, accept, origin, Cache-Control, X-Requested-With")
			ctx.Writer.Header().Set("Access-Control-Allow-Methods", "POST, GET")

			if ctx.Request.Method == "OPTIONS" {
				ctx.AbortWithStatus(204)
				return
			}

			ctx.Next()
		},
		gin.Recovery(),
	)
	return engine
}

func (r *DeploymentCover) Handler(engine *gin.Engine) {
	engine.GET("/sound/deployment", func(ctx *gin.Context) {
		socket, err := r.upgrader.Upgrade(ctx.Writer, ctx.Request, nil)
		if err != nil {
			panic(err)
		}
		r.clients[socket] = true
	})
}

func UploadHandler(engine *gin.Engine, application *app.Application) {
	engine.POST("/sound/upload", func(ctx *gin.Context) {
		price := ctx.Query("price")
		if price == "" {
			ctx.String(http.StatusBadRequest, "missing price")
			return
		}

		cooldown := ctx.Query("cooldown")
		if cooldown == "" {
			ctx.String(http.StatusBadRequest, "missing cooldown")
			return
		}

		name := strings.ToLower(ctx.Query("name"))
		if name == "" {
			ctx.String(http.StatusBadRequest, "missing name")
			return
		}

		references := application.Settings.Audio.References
		_, exists := references[name]

		if exists {
			ctx.String(http.StatusBadRequest, "a sound with that name already exists")
			return
		}

		file, err := ctx.FormFile("file")
		if err != nil {
			ctx.String(http.StatusInternalServerError, "failed fetching audio file")
			return
		}

		checkAndCreatePath()
		if err := ctx.SaveUploadedFile(file, fmt.Sprintf("audio/%s", file.Filename)); err != nil {
			ctx.String(http.StatusInternalServerError, "failed saving file, perhaps it already exists?")
			return
		}

		references[name] = app.AudioReference{
			Price:    util.ForceUint64(price),
			FileName: file.Filename,
			Cooldown: util.ForceUint64(cooldown),
		}
		ctx.String(http.StatusOK, "uploaded new sound successfully")
	})
}