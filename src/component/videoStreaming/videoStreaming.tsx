import React, { useEffect, useRef, useState } from "react";
// @ts-ignore
import RTCMultiConnection from "rtcmulticonnection";
import { io, Socket } from 'socket.io-client';
import styled from "styled-components";
// @ts-ignore
import MRecordRTC from "recordrtc";
import { TailSpin } from "react-loader-spinner";
// import { detectVideo } from "./detectVideo";
// import { Tensor, InferenceSession } from "onnxruntime-web";

type StreamVideoProps = {
  carID: string;
  camNumber: string;
  sourceNumber: number;
  isShowObjectDetection: boolean;
};

const LoadingSpinner: React.FC = () => (
  <TailSpin color="white" height={50} width={50} />
);

const Video = styled.video`
  width: 100%;
  height: auto;
`;

const BlackWindow = styled.div`
  width: 640px;
  height: 480px;
  background-color: black;
  display: flex;
  justify-content: center;
  align-items: center;
`;

const VideoContainer = styled.div`
  position: relative;
  display: flex;
  justify-content: space-between;
`;

const Status = styled.div<{ online: boolean }>`
  position: absolute;
  top: 0;
  right: 0;
  bottom: 0;
  z-index: 99;
  width: 15px;
  height: 15px;
  border-radius: 50%;
  margin: 10px;
  background-color: ${(props) => (props.online ? "green" : "red")};
`;

const StreamVideo: React.FC<StreamVideoProps> = ({
  carID,
  camNumber,
  sourceNumber,
  isShowObjectDetection,
}) => {
  const connection = useRef<RTCMultiConnection>();
  const [stream, setStream] = useState<MediaStream | undefined>();
  const socket = useRef<Socket>();
  const userVideo = useRef<HTMLVideoElement>(null);
  const [isOnline, setIsOnline] = useState<boolean>(false);
  const recorder = useRef<MRecordRTC>();
  const isOnlineRef = useRef<boolean>(false);
  const session = useRef<any>(); // Adjust the type according to your needs
  const modelName = "yolov8n.onnx";
  const modelInputShape: number[] = [1, 3, 640, 640];
  const topk: number = 100;
  const iouThreshold: number = 0.45;
  const scoreThreshold: number = 0.65;
  const isDetect = useRef<boolean>(false);
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const [roomID, setRoomID] = useState<string | null>(null);

  useEffect(() => {
    const initUserVideo = async () => {
      try {
        const devices = await navigator.mediaDevices.enumerateDevices();
        const stream = await selectDevice(devices);
        if (stream) {
          setStream(stream);
        }
        while (!userVideo.current) {
          await new Promise((resolve) => setTimeout(resolve, 300)); // Wait for 100ms
        }
        if (userVideo.current) {
          userVideo.current.srcObject = stream || null;
        }
      } catch (error) {
        console.error("Error accessing webcam:", error);
      }
    };

    initUserVideo();
  }, []);

  const selectDevice = (devices: MediaDeviceInfo[]) => {
    const videoDevices = devices.filter(
      (device) => device.kind === "videoinput"
    );
    if (videoDevices.length === 0) {
      console.error("No video input devices found");
      return;
    }

    const selectedDevice = videoDevices[Number(sourceNumber)].deviceId;

    const constraints = {
      video: {
        deviceId: { exact: selectedDevice },
      },
      audio: false,
    };

    return navigator.mediaDevices.getUserMedia(constraints);
  };

//   useEffect(() => {
//     // Load YOLOv8 model when the component mounts
//     const loadModel = async () => {
//       const baseModelURL = `${process.env.PUBLIC_URL}/model`;

//       const arrBufNet = await fetch(`${baseModelURL}/${modelName}`).then(
//         (response) => response.arrayBuffer()
//       );
//       const yolov8 = await InferenceSession.create(arrBufNet);

//       const arrBufNMS = await fetch(`${baseModelURL}/nms-yolov8.onnx`).then(
//         (response) => response.arrayBuffer()
//       );
//       const nms = await InferenceSession.create(arrBufNMS);

//       session.current = { net: yolov8, nms };
//     };

//     loadModel();
//   }, []);

  useEffect(() => {
    // Start streaming and object detection when the webcam stream is available
    if (
      stream &&
      userVideo.current &&
      session.current &&
      !isDetect.current &&
      roomID &&
      roomID != undefined
    ) {
    //   detectVideo(
    //     userVideo.current,
    //     canvasRef.current,
    //     session.current,
    //     topk,
    //     iouThreshold,
    //     scoreThreshold,
    //     modelInputShape,
    //     socket.current,
    //     roomID
    //   );
      isDetect.current = true;
      startRecording(stream);
    }
  }, [stream, session.current, roomID]);

  useEffect(() => {
    if (!connection.current) {
      connection.current = new RTCMultiConnection();

      connection.current.socketURL = process.env.NEXT_PUBLIC_API_CAM_URI + "/";
      console.log(process.env.NEXT_PUBLIC_API_CAM_URI + "/")

      socket.current = io(
        process.env.NEXT_PUBLIC_API_CAM_URI || '<API-CAM-URL>') as Socket;
      socket.current.emit("car connecting", {
        carID: carID,
        camNumber: camNumber,
      });

      connection.current.socketMessageEvent = "video-broadcast-demo";

      connection.current.session = {
        audio: false,
        video: true,
        oneway: true,
      };

      connection.current.dontCaptureUserMedia = true;

      navigator.mediaDevices
        .enumerateDevices()
        .then((devices) => selectDevice(devices))
        .then((video) => {
          setStream(video);
          socket.current?.on("start detecting", () => {
            console.log("start detect");
          });

          socket.current?.on("stop detecting", () => {
            console.log("stop detect");
          });
          connection.current.videosContainer = document.getElementById(
            `videos-container${camNumber}`
          );

          connection.current.attachStreams = [video];
          startStreaming();
          setInterval(() => {
            startStreaming();
          }, 60000);
        });
    }
  }, []);
  const startStreaming = () => {
    connection.current.sdpConstraints.mandatory = {
      OfferToReceiveAudio: false,
      OfferToReceiveVideo: false,
    };
    connection.current.open(
      `Room${carID}${camNumber}`,
      function (isRoomOpened: boolean) {
        isOnlineRef.current = isRoomOpened;
        setIsOnline(isRoomOpened);
        console.log(connection.current.sessionid);
        setRoomID(connection.current.sessionid);
        if (!isRoomOpened) {
          window.location.reload();
        }
      }
    );
  };

  const startRecording = (stream: MediaStream) => {
    if (stream) {
      recorder.current = new MRecordRTC(stream, {
        type: "video",
        mimeType: "video/webm",
      });

      recorder.current.startRecording();
    } else {
      console.error("Cannot start recording, stream is undefined");
    }
  };
  const stopRecording = () => {
    if (recorder.current) {
      recorder.current.stopRecording(function (url:string) {
        const videoBlob = recorder.current.getBlob();
        const videoUrl = URL.createObjectURL(videoBlob);

        const videoElement = document.getElementById("saveVDO");

        if (videoElement instanceof HTMLVideoElement) {
          videoElement.src = videoUrl;
          videoElement.play();
        } else {
          console.error("Video element not found in the DOM");
        }
        console.log(videoUrl);
        recorder.current.save(); // Save the recorded video
      });
    } else {
      console.error("Cannot stop recording, recorder is undefined");
    }
  };

  useEffect(() => {
    const handleBeforeUnload = () => {
      if (isDetect.current) {
        stopRecording();
      }
    };
    window.addEventListener("popstate", handleBeforeUnload);
    window.addEventListener("beforeunload", handleBeforeUnload);

    return () => {
      window.removeEventListener("beforeunload", handleBeforeUnload);
      window.removeEventListener("popstate", handleBeforeUnload);
    };
  }, []);

  console.log(isOnline)

  return (
    <VideoContainer id={`videos-container${camNumber}`}>
      <Status online={isOnline} />
      <div>
        {stream ? (
          <>
            <Video playsInline muted ref={userVideo} autoPlay />
            <canvas
              id="canvas"
              ref={canvasRef}
              style={{
                position: "absolute",
                top: 0,
                left: 0,
                zIndex: 0,
                display: isShowObjectDetection ? "flex" : "none",
              }}
            />
          </>
        ) : (
          <BlackWindow>
            <LoadingSpinner />
          </BlackWindow>
        )}
      </div>
    </VideoContainer>
  );
};

export default StreamVideo;
