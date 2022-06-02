import { useEffect, useState } from "react";
import {
  AdditionContainer,
  ByAuthorContainer,
  Container,
  CooldownInputContainer,
  InfoContainer,
  SoundTable,
  SoundTableActions,
  SoundTableContainer,
  SoundTableHelper,
  Title,
} from "../style/dashboard";
import { TitleDeploy } from "../util/TitleDeploy";
import { SoundMap, formatNumber, pageOf, notEmptyOrElse, Deployed } from "../util/shared";
import "react-toastify/dist/ReactToastify.css";
import { ToastContainer, toast } from "react-toastify";
import Axios, { AxiosResponse } from "axios";
import { FontAwesomeIcon } from "@fortawesome/react-fontawesome";
import { faPlay, faTrash } from "@fortawesome/free-solid-svg-icons";

const NUMBER_REGEX = /^\d+$/;

const DAY_UNIT = "day";
const HOUR_UNIT = "hour";
const MINUTE_UNIT = "minute";
const SECOND_UNIT = "second";
const MILLISECOND_UNIT = "millisecond";

const TranslateUnit = (unit: string, value: number): number => {
  switch (unit) {
    case DAY_UNIT:
      return value * 24 * 60 * 60 * 1000;
    case HOUR_UNIT:
      return value * 60 * 60 * 1000;
    case MINUTE_UNIT:
      return value * 60 * 1000;
    case SECOND_UNIT:
      return value * 1000;
    default:
      return value;
  }
};

const Upload = async (
  price: number,
  cooldown: number,
  name: string,
  formData: FormData
): Promise<boolean> => {
  return new Promise((resolve) => {
    Axios.post(`http://localhost:9999/sound`, formData, {
      headers: {
        "Content-Type": "multipart/form-data",
      },
      params: {
        price,
        cooldown,
        name,
      },
    })
      .catch(() => resolve(false))
      .then(() => resolve(true));
  });
};

const ToastError = (child: JSX.Element) => {
  toast(child, {
    style: {
      backgroundColor: "rgb(195 83 83)",
    },
  });
};

const BoldSuccessStyle = {
  fontWeight: "bold",
  color: "#2d8538",
};

const ToastSuccess = (child: JSX.Element) => {
  toast(child, {
    style: {
      backgroundColor: "#54b961",
    },
  });
};

function Actions({
  onPlay,
  onDelete,
}: {
  onPlay: () => void;
  onDelete: () => void;
}): JSX.Element {
  return (
    <>
      <button onClick={onPlay}>
        <FontAwesomeIcon icon={faPlay} />
      </button>
      <button onClick={onDelete}>
        <FontAwesomeIcon icon={faTrash} />
      </button>
    </>
  );
}

export default function Dashboard() {
  const [isDeleting, setIsDeleting] = useState(false);
  const [maxSoundsPage, setMaxSoundsPage] = useState(1); // TODO: update on sound deletion and creation
  const [soundsPage, setSoundsPage] = useState(1); // TODO: update on sound deletion when it's the last on its page
  const [sounds, setSounds] = useState<SoundMap>({});

  const [newAudioPrice, setNewAudioPrice] = useState("");
  const [newAudioCooldown, setNewAudioCooldown] = useState("");
  const [newAudioCooldownUnit, setNewAudioCooldownUnit] = useState(SECOND_UNIT);
  const [newAudioName, setNewAudioName] = useState("");
  const [selectedFile, setSelectedFile] = useState<File | null>(null);

  useEffect(() => {
    Axios.get("http://localhost:9999/sounds")
      .catch(console.log)
      .then((it) => {
        const response = it as AxiosResponse<any, any>;
        setSounds((old) => {
          const sounds = { ...old, ...response.data };
          updateMaxSoundsPage(sounds);
          return sounds;
        });
      });
  }, []);

  const updateMaxSoundsPage = (it: SoundMap) => {
    const keys = Object.keys(it);
    setMaxSoundsPage(_ => {
      const value = keys.length == 0 ? 1 : Math.ceil(keys.length / 5);
      if (soundsPage > value) {
        changeSoundsPage(value);
      }
      return value;
    });
  };

  const changeSoundsPage = (page: number) => {
    if (soundsPage == page || page > maxSoundsPage) {
      return;
    }

    if (page <= 0) {
      if (soundsPage != 1) {
        setSoundsPage(1);
      }
      return;
    }

    setSoundsPage(page);
  };

  const deleteSound = (id: string) => {
    if (isDeleting) {
      return;
    }

    setIsDeleting(true);

    setSounds(old => {
      const newVal: SoundMap = {...old};
      delete newVal[id];
      updateMaxSoundsPage(newVal);
      return newVal;
    });

    Axios
      .delete(`http://localhost:9999/sound/${id}`)
      .catch(() => ToastError(<p>Failed deleting sound. Try refreshing the page.</p>))
      .then(res => {
        if (res !== undefined) {
          ToastSuccess(<p>Successfully deleted the sound <span style={BoldSuccessStyle}>{id}</span></p>);
        }
        setIsDeleting(false);
      });
  };

  return (
    <TitleDeploy title="Dashboard">
      <>
        <Container>
          <Title>Dashboard</Title>
          <SoundTableContainer>
            <SoundTable>
              <thead>
                <tr>
                  <th>Name</th>
                  <th>Price</th>
                  <th>Cooldown</th>
                  <th>Actions</th>
                </tr>
              </thead>
              <tbody>
                {notEmptyOrElse(pageOf(sounds, soundsPage, 5), () =>
                  Object.keys(sounds)
                ).map((key) => {
                  const sound = sounds[key];
                  if (!sound) {
                    return <></>;
                  }
                  return (
                    <tr key={sound.file_name}>
                      <td>{key}</td>
                      <td>{sound.price}</td>
                      <td>{formatNumber(sound.cooldown)}</td>
                      <td>
                        <SoundTableActions>
                          <Actions
                            onPlay={() => console.log(`playing ${key}`)}
                            onDelete={() => deleteSound(key)}
                          />
                        </SoundTableActions>
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </SoundTable>
            <SoundTableHelper>
              <label onClick={() => changeSoundsPage(soundsPage - 1)}>
                &#8249;
              </label>
              <button>Create</button>
              <label onClick={() => changeSoundsPage(soundsPage + 1)}>
                &#8250;
              </label>
            </SoundTableHelper>
          </SoundTableContainer>
          {/*<AdditionContainer buttonBackground={selectedFile !== null ? "#5cc769" : "#eb5f5f"}>
            <input type="file" accept="Audio/mp3" id="choose-sound-to-upload" hidden onChange={element => {
              const files = element.target.files;
              if (!files || files.length == 0) {
                return;
              }

              // ensure it's an "mp3" audio file
              const file = files[0];
              if (!file.name.endsWith("mp3")) {
                ToastError(<p>The file type must be of <span style={{fontWeight: "bold"}}>MP3</span>.</p>);
                return;
              }

              setSelectedFile(file);
            }}/>
            <label htmlFor="choose-sound-to-upload">Upload a Sound</label>
            <InfoContainer>
              <input type="text" placeholder="Name" onChange={it => setNewAudioName(it.target.value)} />
              <input type="text" placeholder="Price" onChange={it => setNewAudioPrice(it.target.value)} />
              <CooldownInputContainer>
                <input type="text" placeholder="Cooldown" onChange={it => setNewAudioCooldown(it.target.value)} />
                <select 
                  name="cooldown-units" 
                  id="cooldown-units" 
                  value={newAudioCooldownUnit} 
                  onChange={it => setNewAudioCooldownUnit(it.target.value)}>
                  <option value={DAY_UNIT}>Day</option>
                  <option value={HOUR_UNIT}>Hour</option>
                  <option value={MINUTE_UNIT}>Minute</option>
                  <option value={SECOND_UNIT}>Second</option>
                  <option value={MILLISECOND_UNIT}>Millisecond</option>
                </select>
              </CooldownInputContainer>
            </InfoContainer>
            <button disabled={selectedFile === null} onClick={async () => {
              if (selectedFile === null) {
                ToastError(<p>You must select an Audio file.</p>);
                return;
              }

              if (newAudioName == "") {
                ToastError(<p>Audio name must NOT be empty.</p>);
                return
              }

              if (newAudioPrice == "" || !NUMBER_REGEX.test(newAudioPrice)) {
                ToastError(<p>Audio Price is either invalid or missing - make sure it's a number with no decimals!</p>);
                return
              }

              if (newAudioCooldown == "" || !NUMBER_REGEX.test(newAudioCooldown)) {
                console.log(`'${newAudioCooldown}'`);
                ToastError(<p>Audio Cooldown is either invalid or missing - make sure it's a number with no decimals!</p>);
                return;
              }

              const formData = new FormData();
              formData.append("file", selectedFile);

              const result = await Upload(
                parseInt(newAudioPrice), 
                TranslateUnit(newAudioCooldownUnit, parseInt(newAudioCooldown)), 
                newAudioName, 
                formData
              );

              if (result) {
                ToastSuccess(<p>You have added the Audio <span style={BoldSuccessStyle}>{newAudioName}</span> to the roster with a price of <span style={BoldSuccessStyle}>{newAudioPrice}</span>.</p>)
              } else {
                ToastError(<p>Failed to upload the new Audio... Perhaps it already exists?</p>)
              }
            }}>{selectedFile !== null ? `Add "${selectedFile.name}" to the roster` : "None Selected"}</button>
          </AdditionContainer>*/}
        </Container>
        <ToastContainer
          position="bottom-center"
          bodyStyle={{ color: "#fff" }}
          hideProgressBar={true}
          autoClose={3000}
        />
        <ByAuthorContainer>
          <p>Made with</p>
          <img src="https://pbs.twimg.com/media/FQd_mVSWQAQCW3U.jpg" />
          <p>by</p>
          <a href="https://twitter.com/oliwer_lindell">Oliwer</a>
        </ByAuthorContainer>
      </>
    </TitleDeploy>
  );
}
