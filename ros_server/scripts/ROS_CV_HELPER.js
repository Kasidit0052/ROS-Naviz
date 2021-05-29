////////// Import ROSLIBJS 
const ROSLIB = require('roslib');
////////// Import OpenCV NodeJS 
const cv = require('opencv4nodejs-prebuilt');

class ROS_CV {
    constructor()
    {
        this.local_map_info;
        this.global_map_info;
        this.output_Mat = new cv.Mat();
    }

    SET_GLOBAL_PROPS(map_metadata)
    {
        var that = this;
        that.global_map_info = map_metadata;
    }

    SET_LOCAL_PROPS(map_metadata)
    {
        var that = this;
        that.local_map_info = map_metadata;
    }

    gridMSG_TO_MAT(occupancygrid_msg, Mode)
    {
      const matrix_height = occupancygrid_msg.info.height;
      const matrix_width  = occupancygrid_msg.info.width;
      const occupancyGridMat = new cv.Mat(matrix_height, matrix_width, cv.CV_8UC3);
      for ( var row = 0; row < matrix_height; row++) {
        for ( var col = 0; col < matrix_width; col++) {
            // determine the index of the map data
            var mapI = col + ((matrix_height - row - 1) * matrix_width);
            // determine the value
            var data = occupancygrid_msg.data[mapI];
            if(Mode == 'static')
            {
                var val;
                if (data === 100) {
                    var val = 0;
                } else if (data === 0) {
                    var val = 255;
                } else {
                    var val = 127;
                }
                occupancyGridMat.set(col, row, [val, val, val]);
            }
            if(Mode == 'global')
            {
                var val_B,val_G,val_R;
                if (data === 100) {
                    val_R = 0;
                    val_G = 0;
                    val_B = 255;
                } else {
                    val_R = 127;
                    val_G = 127;
                    val_B = 127;
                }
                occupancyGridMat.set(col, row, [val_B, val_G, val_R]); 
            }
            if(Mode == 'local')
            {
                var val_B,val_G,val_R;
                if (data === 100) {
                val_R = 255;
                val_G = 0;
                val_B = 0;
                } else {
                val_R = 200;
                val_G = 200;
                val_B = 200;
                }
                occupancyGridMat.set(col, row, [val_B, val_G, val_R]);
            }
        }
      }
      var output_mat = occupancyGridMat.rotate(cv.ROTATE_180).flip(1);
      return output_mat;
    }

    costmap_Blending(local_costmap,global_costmap,static_costmap,amcl_pose,costmap_tf)
    {
        var that = this;

        function overlayOnto(source_mat, dest_mat, x, y){
            if(source_mat.channels != dest_mat.channels) throw new Error('src and dst channel counts must match');
            let source_uint8 = new Uint8Array( source_mat.getData() ); // WARNING 4 CHANNELS
            let dest_uint8 = new Uint8Array( dest_mat.getData() ); // WARNING 4 CHANNELS
            let dest_width = dest_mat.cols;
            let x_count = 0; // set counters
            let y_count = 0; // set counters
            let channel_count = source_mat.channels;
            for (let i = 0; i < source_uint8.length; i += channel_count) { // WARNING 4 CHANNELS
                let dest_x = x_count + x; // add offset
                let dest_y = y_count + y; // add offset
                if( !( (dest_x < 0 || dest_x > dest_mat.cols-1) || (dest_y < 0 || dest_y > dest_mat.rows-1) ) ){ // pixel does not fall outside of dest mat
                    // write into buffer array
                    let dest_i = (dest_x + dest_width * dest_y); // (x + w * h) to get x/y coord in single-dimension array
                    let dest_buffer_i = dest_i * channel_count;
                    if(channel_count >= 1)  dest_uint8.fill(source_uint8[i+0], dest_buffer_i+0 , dest_buffer_i+0+1);
                    if(channel_count >= 2)  dest_uint8.fill(source_uint8[i+1], dest_buffer_i+1 , dest_buffer_i+1+1);
                    if(channel_count >= 3)  dest_uint8.fill(source_uint8[i+2], dest_buffer_i+2 , dest_buffer_i+2+1);
                    if(channel_count >= 4)  dest_uint8.fill(source_uint8[i+3], dest_buffer_i+3 , dest_buffer_i+3+1);
                }
                x_count++; // increase col
                x_count = x_count % source_mat.cols; // end of col? move to start
                if(x_count == 0) y_count++; // started new col? increase row 
            }
            return new cv.Mat(dest_uint8, dest_mat.rows, dest_mat.cols, dest_mat.type);
        }

        function quarternion2Theta(orientation)
        {
        var q0 = orientation.w;
        var q1 = orientation.x;
        var q2 = orientation.y;
        var q3 = orientation.z;
        var degree = Math.atan2(2 * (q0 * q3 + q1 * q2), 1 - 2 * (q2 * q2 + q3 * q3)) * 180.0 / Math.PI;
        if(degree < 0){degree = 360+degree;}
        return degree;
        }

        function rotate_image(input_mat, degree)
        {
        const image_center = new cv.Point2(that.local_map_info.width/2,that.local_map_info.height/2);
        const rot_mat = cv.getRotationMatrix2D(image_center,degree,1.0);
        const rotated_mat = input_mat.warpAffine(rot_mat,new cv.Size(that.local_map_info.width,that.local_map_info.height),cv.INTER_LINEAR,cv.BORDER_CONSTANT,new cv.Vec3(127,127,127));
        return rotated_mat;
        }

        // Calculating For the Left anchorpoint of the local costmap
        const w = parseInt(that.local_map_info.width);
        const h = parseInt(that.local_map_info.height);
        const W = parseInt(that.global_map_info.width);
        const H = parseInt(that.global_map_info.height);
        const Mox =  parseFloat(that.global_map_info.origin.position.x);
        const Moy =  parseFloat(that.global_map_info.origin.position.y);
        const resolution = parseFloat(that.global_map_info.resolution);

        const amcl_pose_x = parseInt(parseFloat(amcl_pose.position.x)/resolution);
        const amcl_pose_y = parseInt(parseFloat(amcl_pose.position.y)/resolution);
      
        const origin_pixel_x = W+parseInt(Mox/resolution);
        const origin_pixel_y = H+parseInt(Moy/resolution);

        var anchorpoint_x = origin_pixel_x - w/2 - amcl_pose_y;
        var anchorpoint_y = origin_pixel_y - h/2 - amcl_pose_x;

        // Calculating For Costmap Rotation Angle
        var costmap_angle = 0;
        if(costmap_tf.rotation){costmap_angle = quarternion2Theta(costmap_tf.rotation);}
      
        // Boundary Conditions
        if(anchorpoint_x + w < W && anchorpoint_y + h < H)
        {
          if(anchorpoint_x > 0 && anchorpoint_y > 0)
          {
            const input_costmap = !global_costmap.empty ? cv.addWeighted(global_costmap,0.50,static_costmap,0.50,0.1):static_costmap;
            const cropped_input_costmap = input_costmap.getRegion(new cv.Rect(anchorpoint_x,anchorpoint_y,w,h));
            const cropped_merged_costmap = cv.addWeighted(rotate_image(local_costmap,costmap_angle),0.50,cropped_input_costmap,0.50,0.1);
            const output_costmap = overlayOnto(cropped_merged_costmap,input_costmap,anchorpoint_x,anchorpoint_y);
            output_costmap.drawCircle(new cv.Point2(anchorpoint_x + w/2,anchorpoint_y + h/2),3,new cv.Vec3(0,255,0),1);
            that.output_Mat = output_costmap;
            return output_costmap;
          }
          else
          {
            return that.output_Mat;
          }
        }
        else
        {
          return that.output_Mat;
        }
    }

    ROS_TO_PIXEL(amcl_pose)
    {
        var that = this;

        const W = parseInt(that.global_map_info.width);
        const H = parseInt(that.global_map_info.height);
        const Mox =  parseFloat(that.global_map_info.origin.position.x);
        const Moy =  parseFloat(that.global_map_info.origin.position.y);
        const resolution = parseFloat(that.global_map_info.resolution);

        const amcl_pose_x = parseInt(parseFloat(amcl_pose.position.x)/resolution);
        const amcl_pose_y = parseInt(parseFloat(amcl_pose.position.y)/resolution);
      
        const origin_pixel_x = W+parseInt(Mox/resolution);
        const origin_pixel_y = H+parseInt(Moy/resolution);
      
        var pixel_pose_x = origin_pixel_x - amcl_pose_y;
        var pixel_pose_y = origin_pixel_y - amcl_pose_x;

        return {x:pixel_pose_x ,y:pixel_pose_y};
    }

    PIXEL_TO_ROS(pixel_pose)
    {
        var that = this;

        const W = parseInt(that.global_map_info.width);
        const H = parseInt(that.global_map_info.height);
        const Mox =  parseFloat(that.global_map_info.origin.position.x);
        const Moy =  parseFloat(that.global_map_info.origin.position.y);
        const resolution = parseFloat(that.global_map_info.resolution);

        var ROSX = Moy - resolution*(pixel_pose.x-W);
        var ROSY = Mox - resolution*(pixel_pose.y-H);

        return new ROSLIB.Vector3({x:ROSX,y:ROSY});
    }
}
module.exports = ROS_CV;