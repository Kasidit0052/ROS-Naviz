///////// Dependencies
const express = require('express');
const bodyParser = require('body-parser');

////////// Create Express Server
const app = express();
const port = process.env.PORT || 8000;

////////// CORS Configurations
app.use(bodyParser.json());
app.use(bodyParser.urlencoded({ extended: true }));
app.use(function(req, res, next) {
  res.header("Access-Control-Allow-Origin", "*");
  res.header("Access-Control-Allow-Headers", "Origin, X-Requested-With, Content-Type, Accept");
  next();
});

// Required ROSlib and Ros API Dependencies
const ROSLIB = require('roslib');
const ROS_API = require('./ROS_API.js');


// REST API 
app.post('/api/createWall', (req, res) => {
  const wall_input = req.body;
  if(ros.isConnected){ros_api.requestWALL(wall_input);res.send("Virtual Wall Completely Created");}
  else{res.send("Rosbridge Failed to connect");}
});
app.get('/api/getWall', (req, res) => {
  if(ros.isConnected){console.log("Getted!");res.send(ros_api.wall_list);}
  else{res.send([]);}
});
app.post('/api/deleteWall', (req, res) => {
  const delete_input = req.body;
  if(ros.isConnected){ros_api.deleteWALL(delete_input);res.send("Virtual Wall Completely Deleted");}
  else{res.send("Rosbridge Failed to connect");}
});

app.post('/api/setPose', (req, res) => {
  const initial_input = req.body;
  console.log(initial_input);
  if(ros.isConnected){ros_api.setINITIALPOSE(initial_input);res.send("Initial Pose Success");}
  else{res.send("Rosbridge Failed to connect");}
});

app.post('/api/setGoal', (req, res) => {
  const goal = req.body;
  if(ros.isConnected){ros_api.setGOAL(goal);res.send("robot move sucessfully");}
  else{res.send("Rosbridge Failed to connect");}
});

app.get('/api/stopGoal', (req, res) => {
  if(ros.isConnected){ros_api.cancelGOAL();res.send("robot stop sucessfully");}
  else{res.send("Rosbridge Failed to connect");}
});

/////////// create Socketio server 
var server = app.listen(port, () => console.log(`Listening on port ${port}`));
options={cors:true}
var io = require('socket.io')(server,options);

io.on('connection', (socket) => {
  console.log('a user connected');
});
///////////

// Initialize Ros API
ros = new ROSLIB.Ros();
ros_api = new ROS_API(io,ros);
ros.on('error', function(error){});
ros.on('connection', function(){
  console.log('Connected to websocket server');
  ros_api.runAPI();
  ros_api.startWALL();
});

//Auto Reconnection for roslibjs
intervalid = setInterval(function(){ros.connect("ws://192.168.1.16:9090");},4000);
