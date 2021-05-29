////////// Import ROSLIBJS 
const ROSLIB = require('roslib');
////////// Import OpenCV NodeJS and helpers
const cv = require('opencv4nodejs-prebuilt');
const cv_helper = require('./ROS_CV_HELPER.js');

class ROS {
    constructor(io,ros,odom,amcl,cmdvel,static_costmap,global_costmap,local_costmap,tf, movebase){
        // Define Rostopic Constructor
        this.io = io;
        this.ros = ros;
        this.odom_topic = odom || '/odom';
        this.amcl_topic = amcl || '/amcl_pose';
        this.cmdvel_topic = cmdvel || '/cmd_vel';
        this.initial_pose_topic = '/initialpose';
        this.static_costmap_topic = static_costmap || '/map';
        this.global_costmap_topic = global_costmap || '/move_base/global_costmap/costmap';
        this.local_costmap_topic  =  local_costmap || '/move_base/local_costmap/costmap';
        this.tf_topic = tf || {fixed_frame:'/map',local_frame:'/odom'};
        this.move_base_topic = movebase || '/move_base';

        // Define ROS API Output Messages
        this.cmd_vel = new ROSLIB.Message();
        this.odom_pose = new ROSLIB.Message();
        this.amcl_pose = new ROSLIB.Message();
        this.costmap_tf_msg = new ROSLIB.Message(); 

        // Define OpenCV Output Matrix Var
        this.cv_helper = new cv_helper();
        this.local_map_mat  = new cv.Mat();
        this.static_map_mat = new cv.Mat();
        this.global_map_mat = new cv.Mat();

        // Define VirtualWall API Var and Output Messages
        this.wall_list = [];
        this.clearWallClient = new ROSLIB.Service();
        this.virtualWallClient = new ROSLIB.Service();
        this.deleteWallClient  = new ROSLIB.Service();
    }

    runAPI()
    {
        // Reference Constructor as a variable
        var that = this;

        // Subscribe Cmd Vel Topic
        var cmdVel = new ROSLIB.Topic({
            ros  : this.ros,
            name : this.cmdvel_topic,
            messageType : 'geometry_msgs/Twist'
        });
        cmdVel.subscribe(function(message){that.cmd_vel = message;});


        // Subscribe Odometry Pose Topic
        var Odom = new ROSLIB.Topic({
            ros : this.ros,
            name : this.odom_topic,
            messageType : 'nav_msgs/Odometry'
        });
        Odom.subscribe(function(message){that.odom_pose = message.pose.pose;});

        // Subscribe AMCL Pose Topic
        var Amcl = new ROSLIB.Topic({
            ros : this.ros,
            name : this.amcl_topic,
            messageType : 'geometry_msgs/PoseWithCovarianceStamped'
        });
        Amcl.subscribe(function(message){that.amcl_pose = message.pose.pose;});

        // subscribe to the Static Map OccupancyGrid topic 
        var StaticMap = new ROSLIB.Topic({
            ros : this.ros,
            name: this.static_costmap_topic,
            messageType : 'nav_msgs/OccupancyGrid',
            compression : 'png'
        });
        StaticMap.subscribe(
            function(message)
            {
                that.cv_helper.SET_GLOBAL_PROPS(message.info);
                that.static_map_mat = that.cv_helper.gridMSG_TO_MAT(message,'static');
            }
        );

        
        // subscribe to the Global Map OccupancyGrid topic 
        var GlobalMap = new ROSLIB.Topic({
            ros : this.ros,
            name: this.global_costmap_topic,
            messageType : 'nav_msgs/OccupancyGrid',
            compression : 'png'
        });
        GlobalMap.subscribe(
            function(message)
            {
                that.global_map_mat = that.cv_helper.gridMSG_TO_MAT(message,'global');
            }
        );


        // subscribe to the Local Map OccupancyGrid topic 
        var LocalMap = new ROSLIB.Topic({
            ros : this.ros,
            name: this.local_costmap_topic,
            messageType : 'nav_msgs/OccupancyGrid',
            compression : 'png'
        });
        LocalMap.subscribe(
            function(message)
            {
                that.cv_helper.SET_LOCAL_PROPS(message.info);
                that.local_map_mat = that.cv_helper.gridMSG_TO_MAT(message,'local');

                if(that.cv_helper.local_map_info && that.cv_helper.global_map_info)
                {
                    //Emit Global and Local Costmap
                    const output_costmap = that.cv_helper.costmap_Blending(that.local_map_mat,that.global_map_mat,that.static_map_mat,that.amcl_pose,that.costmap_tf_msg);
                    const outBase64 =  cv.imencode('.jpg', output_costmap).toString('base64');
                    const output = 'data:image/jpeg;base64,' + outBase64;
                    that.io.emit('Occupancy Grid',output);

                    //Emit Amcl pose
                    function quadTotheta(pose) {
                        // convert to radians
                        var q0 = pose.orientation.w;
                        var q1 = pose.orientation.x;
                        var q2 = pose.orientation.y;
                        var q3 = pose.orientation.z;
                        var theta = Math.atan2(
                        2 * (q0 * q3 + q1 * q2),
                        1 - 2 * (Math.pow(q2, 2) + Math.pow(q3, 2))
                        );

                        // convert to degrees
                        var deg = theta * (180.0 / Math.PI);
                        if (deg >= 0 && deg <= 180) {
                        deg += 270;
                        } else {
                        deg -= 90;
                        }
                        return -deg;
                    }
                    var transformed_pose = JSON.parse(JSON.stringify(that.amcl_pose));
                    transformed_pose.position = that.cv_helper.ROS_TO_PIXEL(transformed_pose);
                    transformed_pose.orientation = quadTotheta(transformed_pose);
                    that.io.emit('Amcl Pose', transformed_pose);
                }
            }
        );

        // subscribe to robot transform
        var tfClient = new ROSLIB.TFClient({
            ros : this.ros,
            fixedFrame : this.tf_topic.fixed_frame,
            angularThres : 0.01,
            transThres : 0.01
        });
        tfClient.subscribe(this.tf_topic.local_frame,function(message){that.costmap_tf_msg = message;});

        // initialize initialpose client
        that.initialPose = new ROSLIB.Topic({
            ros : this.ros,
            name: this.initial_pose_topic,
            messageType : 'geometry_msgs/PoseWithCovarianceStamped',
        });

        // Init MoveBase Client
        that.actionClient = new ROSLIB.ActionClient({
            ros : this.ros,
            serverName : this.move_base_topic,
            actionName : 'move_base_msgs/MoveBaseAction'
        });

    }

    startWALL()
    {
        // References the constructor
        var that = this;

        // Create a virtual wall Service Clients
        that.virtualWallClient = new ROSLIB.Service({
            ros : this.ros,
            name : '/virtual_wall_server/create_wall',
            serviceType : 'move_base_virtual_wall_server/CreateWall'
        });

        // Create a delete wall Service Clients
        that.deleteWallClient  = new ROSLIB.Service({
            ros : this.ros,
            name: '/virtual_wall_server/delete_wall',
            serviceType : 'move_base_virtual_wall_server/DeleteWall'
        });

        // Create a service to clear a costmap
        that.clearWallClient   =  new ROSLIB.Service({
            ros : this.ros,
            name: '/move_base/clear_costmaps'
        });
    }

    requestWALL(wall_input)
    {
        // References the constructor
        var that = this;

        // Function to Generate Virtual Wall Request
        function getRequest(wall_id,P1,P2){
            return new ROSLIB.ServiceRequest({
                id : wall_id,
                start_point : that.cv_helper.PIXEL_TO_ROS(P1),
                end_point   : that.cv_helper.PIXEL_TO_ROS(P2)
            });
        }

        ///Example Object
        // const wall_dummy =[
        //     {
        //         start_point:{x:120.0,y:180.0},
        //         end_point:{x:150.0,y: 180.0}
        //     },
        //     {
        //         start_point:{x:180.0,y:170.0},
        //         end_point:{x:180.0,y: 200.0}
        //     }
        // ];
        wall_input.forEach((wall,index)=>{

            // Referencing Tracking Variable 
            var wall_list = that.wall_list;

            // Assigning Individual Wall Id to each of the wall
            var wall_id = wall_list.length > 0 ? wall_list[wall_list.length-1].wall_id + 1 : 0;

            // Append new wall to the wall list
            wall['wall_id'] = wall_id;
            that.wall_list.push(wall);

            // Get Request Messages
            var request = getRequest(wall.wall_id,wall.start_point,wall.end_point);
    
            // Send Request Messages
            that.virtualWallClient.callService(request, function(result) {
                console.log('Wall Created');
            }); 
        });
    }

    deleteWALL(delete_input)
    {
        // References the constructor
        var that = this;

        // Function to request for Virtual Wall Removal
        function getRequest(wall_id){
            return new ROSLIB.ServiceRequest({
                id : wall_id
            });
        }

        ///Example Object
        // const delete_dummy =[1,2,3,4,5];
        delete_input.forEach((idx,index)=>{

            // check for the existence of the wall
            const current_wall = that.wall_list.find(elem => elem.wall_id == idx);
            if(typeof current_wall !== 'undefined')
            {
                // create a Request Messages
                var request = getRequest(current_wall.wall_id); 

                // Send a Request Messages
                that.deleteWallClient.callService(request, function(result) {
                    console.log('Wall Deleted');
                }); 

                // Remove from tracking wall list
                that.wall_list = that.wall_list.filter(elem => elem != current_wall);
            }      
        });

        // Wait for 1 sec and Finally clear costmap debris
        setTimeout(function(){that.clearWallClient.callService(new ROSLIB.ServiceRequest())}, 1000);
    }

    ///Example Object
    // const initial_pose = { position: { x: 194.609375, y: 120.59375 }, orientation: { theta: -0.7044940642422177 }}
    setINITIALPOSE(pose)
    {
        //References the constructor
        var that = this;

        // Transform theta to quarternions
        var thetaRadians  = pose.orientation.theta;
        if (thetaRadians >= 0 && thetaRadians <= Math.PI) {
          thetaRadians += (3 * Math.PI / 2);
        } else {
          thetaRadians -= (Math.PI/2);
        }
        var qz =  Math.sin(thetaRadians/2.0);
        var qw =  Math.cos(thetaRadians/2.0);

        // Create initial pose message
        var default_poseWithCovarianceStamped = new ROSLIB.Message({
            header: {
            frame_id: 'map'
            },
            pose: {
            pose:
            {
            position: that.cv_helper.PIXEL_TO_ROS(pose.position),
            orientation: { x: 0.0, y: 0.0, z: qz, w: qw },
            },
            covariance: [
            0.25, 0.0, 0.0, 0.0, 0.0, 0.0,
            0.0, 0.25, 0.0, 0.0, 0.0, 0.0,
            0.0, 0.0, 0.0, 0.0, 0.0, 0.0,
            0.0, 0.0, 0.0, 0.0, 0.0, 0.0,
            0.0, 0.0, 0.0, 0.0, 0.0, 0.0,
            0.0, 0.0, 0.0, 0.0, 0.0, 0.07]
            }
        });
        // Publish Initialpose topic
        this.initialPose.publish(default_poseWithCovarianceStamped);
    }

    ///Example Object
    // const goal = { position: { x: 194.609375, y: 120.59375 }, orientation: { theta: -0.7044940642422177 }}
    setGOAL(pose)
    {

        //References the constructor
        var that = this;

        // Transform theta to quarternions
        var thetaRadians  = pose.orientation.theta;
        if (thetaRadians >= 0 && thetaRadians <= Math.PI) {
            thetaRadians += (3 * Math.PI / 2);
        } else {
           thetaRadians -= (Math.PI/2);
        }
        var qz =  Math.sin(thetaRadians/2.0);
        var qw =  Math.cos(thetaRadians/2.0);
 
        // Initializing ROSLIB Goal Pose
        var positionVec3 = that.cv_helper.PIXEL_TO_ROS(pose.position);
        var orientation = new ROSLIB.Quaternion({x:0, y:0, z:qz, w:qw});

        console.log(positionVec3);

        var posemsg = new ROSLIB.Pose({
            position : positionVec3,
            orientation : orientation
        });

        // Initializing Goal 
        var goal = new ROSLIB.Goal({
            actionClient : this.actionClient,
            goalMessage : {target_pose : {
            header : {
                frame_id : 'map'
            },
                pose : posemsg
            }
            }
        });

        // Send Goal
        goal.send();

        // Check for result and stop actionclient
        goal.on('result',function(result)
        {
            // cancel all goal associate with this action client
            that.actionClient.cancel();
            console.log("robot at goal");
        });
    }

    cancelGOAL()
    {
        // References the constructor
        var that = this;

        // cancel all goal associate with this action client
        that.actionClient.cancel();
        console.log("robot is stopping");
    }
}
module.exports = ROS;