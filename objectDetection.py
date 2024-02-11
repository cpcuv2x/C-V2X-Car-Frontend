from ultralytics import YOLO
import socketio
import requests
import threading

# Create Socket.IO client
sio = socketio.Client()

# Set the Socket.IO server URL
server_url = "http://localhost:5002/"

carID = "65ac9720191a85b6842de0ec"

response = requests.get(f"{server_url}api/cars/{carID}")

if (response.status_code != 200):
    print("can not connect to server")
    exit()

cameras =  response.json()["data"]["cameras"]


@sio.event
def connect():
    print("Connected to server")

@sio.event
def disconnect():
    print("Disconnected from server")

# Process results and send to the server
def process_and_send_results(boxes, roomID):
    sio.emit("send object detection", {
        "boxes": boxes,
        "roomID": roomID,
      })
    print("Object detection results sent to server")


# Connect to the Socket.IO server
sio.connect(server_url)

def thread_callback(roomID):
    # Load YOLOv8 model
    model = YOLO("yolov8n.pt")  # Replace with the correct path or configuration
    results = model(source=0, conf=0.8, stream=True, imgsz=(480, 640))

    # Process results list
    for i, result in enumerate(results):
        # Access bounding boxes, labels, and confidence scores
        boxes = result.boxes
        orig_shape = result.orig_shape  # Get the original shape of the image
        confident_boxes = boxes.conf
        boundary = boxes.xywh
        boxes_normalized = []
        for j,box in enumerate(boxes):
            # boundary = box.xyxy[0]  # get box coordinates in (left, top, right, bottom) format
            # x, y, w, h = box.xywhn
            # w = right-x
            # h = y-bottom
            c = box.cls
            # print("XYWH:",(boundary).tolist()[j])
            x,y,w,h = (boundary).tolist()[j]
            x_normalized = (x - 0.5 * w) / orig_shape[1]
            y_normalized = (y - 0.5 * h) / orig_shape[0]
            w_normalized = w / orig_shape[1]
            h_normalized = h / orig_shape[0]
            score = confident_boxes.tolist()[j]
            label = model.names[int(c)]
            bounding_normalized = [x_normalized, y_normalized, w_normalized, h_normalized]
            payload = {
            "label": label,
            "probability": score,
            "label_number": int(c),
            "bounding": bounding_normalized,
            }
            boxes_normalized.append(payload)

        process_and_send_results(boxes_normalized,roomID)






for camera in cameras:
    camID = camera["id"]
    # Define the roomID (replace with the actual roomID)
    roomID = f"Room{carID}{camID}"
    thr = threading.Thread(target=thread_callback, args=[roomID])
    thr.start()

sio.wait()