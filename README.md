# Welcome to ROS Naviz
**Naviz** is our implementation of ROS web-based visualization with full functionality from RVIZ with additional Virtual Wall server 


![Alt Text](https://github.com/Kasidit0052/ROS_Naviz/blob/main/ros_result.gif)


## Files structure

### Server :

- **ros_server**
  - **robot-app**
  - scripts
  - package.json

### Client :

- **robot-app**
  - public
  - src
  - package.json
  
### Robot Config :
- turtlebot3_config
  - costmap_common_params_burger.yaml
  - global_costmap_params.yaml
  - local_costmap_params.yaml

### VirtualWall Launch :
- launch
  - Virtual_wall.launch

## ROS-Naviz Installation (Requires npm or yarn installed)

```
cd ~/catkin_ws/src/
```
```
git clone https://github.com/Kasidit0052/ROS-Naviz.git
```
- Install Server
```
cd ros_server
yarn install
```
- Install Client
```
cd robot-app
yarn install
```

## Dependencies Installation

### Install Rosbridge package

```
sudo apt-get install ros-melodic-rosbridge-suite
```

### Install turtlebot3 and turtlebot3_simulations packages

```
cd ~/catkin_ws/src/
```
```
git clone https://github.com/ROBOTIS-GIT/turtlebot3.git
git clone https://github.com/ROBOTIS-GIT/turtlebot3_simulations.git
```
```
cd ..
catkin_make
```
### Install tf2_web_republisher from Robotwebtools

```
cd ~/catkin_ws/src/
```
```
git clone https://github.com/RobotWebTools/tf2_web_republisher.git
sudo apt-get install ros-melodic-tf2-ros
```
```
cd ..
catkin_make
```

### Install Virtual Wall Server Package

```
cd ~/catkin_ws/src/
```
```
git clone https://github.com/hoshianaaa/move_base_virtual_wall_server.git
```
- Replace MoveBase params using our files from robot config folder
- Move our repository launch file to move_base_virtual_wall_server folder
```
cd ..
catkin_make
```

## Executing program

### Robot Initialization :

```
roscore
```

```
roslaunch rosbridge_server rosbridge_websocket.launch
```

```
roslaunch turtlebot3_gazebo turtlebot3_world.launch
```

```
roslaunch turtlebot3_navigation turtlebot3_navigation.launch
```

```
roslaunch move_base_virtual_wall_server Virtual_wall.launch
```

```
rosrun tf2_web_republisher tf2_web_republisher
```

### Server :

```
cd ~/catkin_ws/src/ROS-Naviz/ros_server
yarn server
```

### Client :

```
cd ~/catkin_ws/src/ROS-Naviz/ros_server
yarn client
```



## Authors

Contributors names and contact info

Kasidit Web (Backend, ROS developer)
[Kasidit's github](https://github.com/Kasidit0052)

Ton Tosirikul (Frontend developer)
[TonTosirikul's site](https://tontosirikul.github.io/#/)

## Acknowledgments

Inspiration, code snippets, etc.

- [move-base-virtual-wall-server](https://github.com/hoshianaaa/move_base_virtual_wall_server) Thanks to this developer for virtual wall
- [React-konva](https://github.com/konvajs/react-konva) Thanks to this developer for canvas manipulation.
