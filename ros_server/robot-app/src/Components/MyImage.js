import { Image } from "react-konva";
import useImage from "use-image";
import { Stage, Layer, Line, Arrow, Shape } from "react-konva";
import React, { useState, useEffect } from "react";
import "../style/MapSection.scss";
import { Container, Grid, Button } from "@material-ui/core";
import img from "../static/black.jpg";

class URLImage extends React.Component {
  state = {
    image: null,
  };
  componentDidMount() {
    this.loadImage();
  }
  componentDidUpdate(oldProps) {
    if (oldProps.src !== this.props.src) {
      this.loadImage();
    }
  }
  componentWillUnmount() {
    this.image.removeEventListener("load", this.handleLoad);
  }
  loadImage() {
    // save to "this" to remove "load" handler on unmount
    this.image = new window.Image();
    this.image.src = this.props.src;
    this.image.addEventListener("load", this.handleLoad);
  }
  handleLoad = () => {
    // after setState react-konva will update canvas and redraw the layer
    // because "image" property is changed
    this.setState({
      image: this.image,
    });
    // if you keep same image object during source updates
    // you will have to update layer manually:
    // this.imageNode.getLayer().batchDraw();
  };
  render() {
    return (
      <Image
        x={this.props.x}
        y={this.props.y}
        image={this.state.image}
        ref={(node) => {
          this.imageNode = node;
        }}
      />
    );
  }
}

class Drawable {
  constructor(startx, starty) {
    this.startx = startx;
    this.starty = starty;
  }
}

class ArrowDrawable extends Drawable {
  constructor(startx, starty) {
    super(startx, starty);
    this.x = startx;
    this.y = starty;
  }
  registerMovement(x, y) {
    this.x = x;
    this.y = y;
  }
  render() {
    const points = [this.startx, this.starty, this.x, this.y];
    return <Arrow points={points} fill="white" stroke="white" />;
  }
}

var localhost = "192.168.1.16";
async function saveWallAPI(input) {
  const response = await fetch(`http://${localhost}:8000/api/createWall`, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
    },
    body: JSON.stringify(input),
  });
}
async function deleteWallAPI(input) {
  const response = await fetch(`http://${localhost}:8000/api/deleteWall`, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
    },
    body: JSON.stringify(input),
  });
}

async function initialPoseAPI(input) {
  const response = await fetch(`http://${localhost}:8000/api/setPose`, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
    },
    body: JSON.stringify(input),
  });
}

async function moveBaseAPI(input) {
  const response = await fetch(`http://${localhost}:8000/api/setGoal`, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
    },
    body: JSON.stringify(input),
  });
}

async function moveBaseStopAPI() {
  const response = await fetch(`http://${localhost}:8000/api/stopGoal`);
}

const MyImage = ({ socket, x, y }) => {
  const [src, setSrc] = useState(null);

  const [mode, setMode] = useState("Normal mode");

  const [isDraw, setIsDraw] = useState(false);
  const [points, setPoints] = useState([]);
  const [lines, setLines] = useState([]);

  const [isDeleteWall, setIsDeleteWall] = useState(false);
  const [currentWall, setCurrentWall] = useState([]);
  const [selectedWall, setSelectedWall] = useState([]);

  const [isInitial, setIsInitial] = useState(false);
  const [arrow, setArrow] = useState([]);

  const [isGoal, setIsGoal] = useState(false);

  const [isRobot, setIsRobot] = useState({
    status: true,
    x: 20,
    y: 100,
    orientation: 90,
  });

  useEffect(() => {
    setSrc(img);
    socket.on("Occupancy Grid", (dataURI) => {
      setSrc(dataURI);
    });
    socket.on("Amcl Pose", (amclPOSE) => {
      console.log(amclPOSE);
      setIsRobot({
        status: true,
        x: parseInt(amclPOSE.position.x),
        y: parseInt(amclPOSE.position.y),
        orientation: parseInt(amclPOSE.orientation) + 90,
      });
    });
  }, []);

  function getNewArrow(x, y) {
    return new ArrowDrawable(x, y);
  }

  async function fetchWallAPI() {
    const response = await fetch(`http://${localhost}:8000/api/getWall`);
    const res = await response.json();
    setCurrentWall(res);
  }

  function saveWall() {
    setMode("Normal mode");
    setIsDraw(false);
    console.log("saved");
    //console.log(lines);
    const virtual_wall = [];
    lines.map((line) =>
      virtual_wall.push({
        start_point: { x: line[1], y: line[0] },
        end_point: { x: line[3], y: line[2] },
      })
    );
    // for post the data of virtual wall object
    setPoints([]);
    setLines([]);
    // send api
    saveWallAPI(virtual_wall);
  }

  function deleteWall() {
    setMode("Delete Wall mode");
    fetchCurrentWall();
  }

  function fetchCurrentWall() {
    fetchWallAPI();
  }
  function sendSelectedWall(selected_wall) {
    deleteWallAPI(selected_wall);
  }

  function clearSelectedWall() {
    setIsDeleteWall(false);
    setMode("Normal mode");
    setSelectedWall([]);
  }
  function clearLines() {
    setMode("Normal mode");
    setIsDraw(false);
    setLines([]);
    setPoints([]);
  }
  function handleMouseDown(e) {
    if (points.length === 0) {
      const pos = e.target.getStage().getPointerPosition();
      setPoints([...points, pos.x, pos.y]);
    } else {
      const endpoint = e.target.getStage().getPointerPosition();
      setPoints([...points, endpoint.x, endpoint.y]);
    }
  }

  function handleArrowDown(e) {
    const newArrow = arrow;
    if (newArrow.length === 0) {
      const { x, y } = e.target.getStage().getPointerPosition();
      const newDrawable = getNewArrow(x, y);
      setArrow([newDrawable]);
    }
  }
  // for calculating orientation
  function handleArrowUp(e) {
    const newDraw = arrow;
    if (newDraw.length === 1) {
      const { x, y } = e.target.getStage().getPointerPosition();
      const drawableToAdd = newDraw[0];
      drawableToAdd.registerMovement(x, y);

      const deltaX = drawableToAdd.startx - drawableToAdd.x;
      const deltaY = drawableToAdd.starty - drawableToAdd.y;
      const thetaRadians = Math.atan2(deltaX, deltaY) + Math.PI / 2;

      if (isInitial) {
        const initial_pose = {
          position: { x: drawableToAdd.starty, y: drawableToAdd.startx },
          orientation: { theta: thetaRadians },
        };
        console.log(initial_pose);
        initialPoseAPI(initial_pose);
      } else if (isGoal) {
        const goal = {
          position: { x: drawableToAdd.starty, y: drawableToAdd.startx },
          orientation: { theta: thetaRadians },
        };
        console.log(goal);
        moveBaseAPI(goal);
      }

      setArrow([]);
    }
  }

  function handleArrowMove(e) {
    const newDraw = arrow;
    if (newDraw.length === 1) {
      const { x, y } = e.target.getStage().getPointerPosition();
      const updatedNewDrawable = newDraw[0];
      updatedNewDrawable.registerMovement(x, y);
      setArrow([updatedNewDrawable]);
    }
  }

  useEffect(() => {
    var temp = [];
    if (points.length >= 4) {
      for (let i = 0; i < points.length; i++) {
        if (temp.length <= 4) {
          temp.push(points[i]);
          if (temp.length === 4) {
            setLines([...lines, temp]);
            temp = temp.slice(2, 4);
          }
        }
      }
    }
  }, [points]);

  useEffect(() => {});
  return (
    <div className="MapSection" style={{ margin: "1rem" }}>
      <Grid container direction="row" justify="center" alignItems="center">
        <h2>MODE:{mode}</h2>

        <h2 style={{ margin: "1rem" }}>Selected Wall ID:{selectedWall}</h2>
      </Grid>
      <Container
        className="Map"
        style={{
          height: 381,
          width: 381,
        }}
      >
        <Stage
          width={381}
          height={381}
          style={{ border: "1px solid #000000" }}
          onMouseDown={
            isDraw
              ? handleMouseDown
              : isInitial || isGoal
              ? handleArrowDown
              : null
          }
          onMouseUp={handleArrowUp}
          onMouseMove={handleArrowMove}
        >
          <Layer>
            <URLImage src={src} x={x} y={y} />
          </Layer>
          <Layer>
            {lines.map((xline, i) => (
              <Line
                key={i}
                points={xline}
                stroke={src === img ? "white" : "black"}
                strokeWidth={0.5}
                tension={0.5}
                lineCap="round"
              />
            ))}
          </Layer>

          {isRobot.status ? (
            <Layer>
              <Shape
                sceneFunc={(context, shape) => {
                  var size = 10;
                  context.beginPath();
                  context.moveTo(-size / 2.0, -size / 2.0);
                  context.lineTo(size, 0);
                  context.lineTo(-size / 2.0, size / 2.0);
                  context.closePath();
                  context.fillStrokeShape(shape);
                }}
                fill="#00D2FF"
                stroke="black"
                strokeWidth={1}
                // update position here
                x={isRobot.x}
                y={isRobot.y}
                rotation={isRobot.orientation + 90}
              />
            </Layer>
          ) : null}

          {isDeleteWall ? (
            <Layer>
              {currentWall.map((line, i) => (
                <Line
                  key={line.wall_id}
                  points={[
                    line.start_point.y,
                    line.start_point.x,
                    line.end_point.y,
                    line.end_point.x,
                  ]}
                  stroke={"white"}
                  strokeWidth={2}
                  tension={0.5}
                  lineCap="round"
                  onMouseEnter={(e) => {
                    // style stage container:
                    const container = e.target.getStage().container();
                    container.style.cursor = "pointer";
                  }}
                  onMouseLeave={(e) => {
                    const container = e.target.getStage().container();
                    container.style.cursor = "default";
                  }}
                  onMouseDown={() => {
                    var newWallSelected = [...selectedWall];
                    if (selectedWall.indexOf(line.wall_id) === -1)
                      newWallSelected.push(line.wall_id);
                    setSelectedWall(newWallSelected);
                  }}
                />
              ))}
            </Layer>
          ) : null}
          {/* layer for initial pose */}
          <Layer>
            {arrow.length === 1 ? arrow.map((i) => i.render()) : null}
          </Layer>
          {/* {newdrawables.map((drawable) => {
            return drawable.render();
          })} */}
        </Stage>
      </Container>

      <Grid container direction="row" justify="center" alignItems="center">
        <Button
          variant="contained"
          color={!isInitial ? "primary" : "secondary"}
          onClick={
            !isInitial
              ? () => {
                  setMode("Initial mode");
                  setIsInitial(true);
                }
              : () => {
                  setMode("Normal mode");
                  setIsInitial(false);
                }
          }
          style={{ margin: "1rem" }}
          disabled={isDraw || isDeleteWall || isGoal}
        >
          {!isInitial ? "Initial pose" : "Stop Initial"}
        </Button>
        <Button
          variant="contained"
          color={!isGoal ? "primary" : ""}
          onClick={
            !isGoal
              ? () => {
                  setMode("Send Goal mode");
                  setIsGoal(true);
                }
              : () => {
                  setMode("Normal mode");
                  setIsGoal(false);
                }
          }
          style={{ margin: "1rem" }}
          disabled={isDraw || isDeleteWall || isInitial}
        >
          {!isGoal ? "Send Goal" : "Exit Goal"}
        </Button>

        <Button
          variant="contained"
          color="primary"
          style={{ margin: "1rem" }}
          onClick={
            isDraw
              ? () => {
                  setIsDraw(false);
                  saveWall();
                }
              : () => {
                  setMode("Draw mode");
                  setIsDraw(true);
                }
          }
          disabled={isDeleteWall || isInitial || isGoal}
        >
          {isDraw ? "Save virtual wall" : "Add Virtual wall"}
        </Button>

        <Button
          variant="contained"
          color={isDeleteWall ? "secondary" : "primary"}
          style={{ margin: "1rem" }}
          disabled={isDraw || isInitial || isGoal}
          onClick={
            !isDeleteWall
              ? () => {
                  setIsDeleteWall(true);
                  deleteWall();
                }
              : () => {
                  sendSelectedWall(selectedWall);
                  clearSelectedWall();
                }
          }
        >
          {isDeleteWall ? "Confirm Remove" : "Remove Wall"}
        </Button>
      </Grid>
      <Grid>
        <Button
          variant="contained"
          color={!isGoal ? "primary" : "secondary"}
          onClick={() => {moveBaseStopAPI()}}
          style={{ margin: "1rem" }}
          disabled={!isGoal}
        >
          Emergency STOP
        </Button>
        <Button
          variant="contained"
          color=""
          style={{ margin: "1rem" }}
          disabled={!isDraw && !isDeleteWall}
          onClick={
            !isDeleteWall ? () => clearLines() : () => clearSelectedWall()
          }
        >
          CANCEL
        </Button>
      </Grid>
    </div>
  );
};

export default MyImage;
