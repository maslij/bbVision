import React from 'react';
import VisibilityIcon from '@mui/icons-material/Visibility';
import PeopleIcon from '@mui/icons-material/People';
import DirectionsCarIcon from '@mui/icons-material/DirectionsCar';

// Default line zone used as a template
export const defaultLineZone = {
  id: "zone1",
  start_x: 0.2,
  start_y: 0.5,
  end_x: 0.8,
  end_y: 0.5,
  min_crossing_threshold: 1,
  triggering_anchors: ["BOTTOM_CENTER", "CENTER"]
};

// Default polygon zone used as a template
export const defaultPolygonZone = {
  id: "zone1",
  polygon: [
    { x: 0.2, y: 0.2 },
    { x: 0.8, y: 0.2 },
    { x: 0.8, y: 0.8 },
    { x: 0.2, y: 0.8 }
  ],
  min_crossing_threshold: 1,
  triggering_anchors: ["BOTTOM_CENTER", "CENTER"]
};

// Pipeline Template interface
export interface PipelineTemplate {
  id: string;
  name: string;
  description: string;
  icon: React.ReactNode;
  // REMOVED: requiredLicenseTier - now checked dynamically based on components
  requiresInferenceServer: boolean;
  components: {
    processors: {
      type: string;
      config: any;
    }[];
    sinks?: {
      type: string;
      config: any;
    }[];
  };
}

/**
 * Check if a template is allowed based on NEW billing system
 * @param template The pipeline template
 * @param licenseMode Current license mode ("trial" | "base" | "unlicensed")
 * @param enabledGrowthPacks Array of enabled growth pack names
 * @returns Object with allowed status and reason if blocked
 */
export const isTemplateAllowed = (
  template: PipelineTemplate,
  licenseMode: string,
  enabledGrowthPacks: string[]
): { allowed: boolean; reason?: string } => {
  // Check each processor in the template
  for (const processor of template.components.processors) {
    const type = processor.type;
    
    // Line zones require Base License
    if (type === 'line_zone_manager') {
      if (licenseMode === 'trial') {
        return { 
          allowed: false, 
          reason: 'Line zones require Base License ($60/camera/month)' 
        };
      }
    }
    
    // Polygon zones require Base License
    if (type === 'polygon_zone_manager') {
      if (licenseMode === 'trial') {
        return { 
          allowed: false, 
          reason: 'Polygon zones require Base License ($60/camera/month)' 
        };
      }
    }
    
    // Age/Gender detection requires Active Transport pack
    if (type === 'age_gender_detection') {
      if (!enabledGrowthPacks.includes('Active Transport')) {
        return { 
          allowed: false, 
          reason: 'Requires Active Transport growth pack ($30/month)' 
        };
      }
    }
  }
  
  // Check each sink in the template
  if (template.components.sinks) {
    for (const sink of template.components.sinks) {
      const type = sink.type;
      
      // Database sink requires Base License
      if (type === 'database') {
        if (licenseMode === 'trial') {
          return { 
            allowed: false, 
            reason: 'Database storage requires Base License ($60/camera/month)' 
          };
        }
      }
    }
  }
  
  return { allowed: true };
};

// Define available pipeline templates
export const pipelineTemplates: PipelineTemplate[] = [
  {
    id: 'object-detection',
    name: 'Basic Object Detection',
    description: 'Detect common objects in the video stream',
    icon: <VisibilityIcon />,
    // NO hardcoded tier - object detection allowed on trial!
    requiresInferenceServer: true, // Requires Triton inference server
    components: {
      processors: [
        {
          type: 'object_detection',
          config: {
            model_id: "yolov7",
            server_url: "http://localhost:8000",
            confidence_threshold: 0.5,
            draw_bounding_boxes: true,
            use_shared_memory: true,
            label_font_scale: 0.5,
            classes: ["person", "car", "truck", "bicycle", "motorcycle", "bus"]
          }
        }
      ]
    }
  },
  {
    id: 'person-counting',
    name: 'Person Counting',
    description: 'Count people crossing defined lines/zones',
    icon: <PeopleIcon />,
    // NO hardcoded tier - blocked dynamically because of line_zone_manager + database
    requiresInferenceServer: true, // Requires Triton inference server
    components: {
      processors: [
        {
          type: 'object_detection',
          config: {
            model_id: "yolov7_qat",
            server_url: "http://localhost:8000",
            confidence_threshold: 0.5,
            draw_bounding_boxes: true,
            use_shared_memory: true,
            label_font_scale: 0.5,
            classes: ["person"]
          }
        },
        {
          type: 'object_tracking',
          config: {
            frame_rate: 30,
            track_buffer: 30,
            track_thresh: 0.5,
            high_thresh: 0.6,
            match_thresh: 0.8,
            draw_tracking: true,
            draw_track_trajectory: true,
            draw_track_id: true,
            draw_semi_transparent_boxes: true,
            label_font_scale: 0.6
          }
        },
        {
          type: 'line_zone_manager',
          config: {
            draw_zones: true,
            line_color: [255, 255, 255],
            line_thickness: 2,
            draw_counts: true,
            text_color: [0, 0, 0],
            text_scale: 0.5,
            text_thickness: 2,
            zones: [{
              id: "entrance",
              start_x: 0.2,
              start_y: 0.5,
              end_x: 0.8,
              end_y: 0.5,
              min_crossing_threshold: 1,
              triggering_anchors: ["BOTTOM_CENTER", "CENTER"]
            }]
          }
        }
      ],
      sinks: [
        {
          type: 'database',
          config: {
            store_thumbnails: false,
            thumbnail_width: 320,
            thumbnail_height: 180,
            retention_days: 30,
            store_detection_events: false,
            store_tracking_events: false,
            store_counting_events: true
          }
        }
      ]
    }
  },
  {
    id: 'traffic-analysis',
    name: 'Traffic Analysis',
    description: 'Track and count vehicles crossing defined lines',
    icon: <DirectionsCarIcon />,
    // NO hardcoded tier - blocked dynamically because of line_zone_manager + database
    requiresInferenceServer: true, // Requires Triton inference server
    components: {
      processors: [
        {
          type: 'object_detection',
          config: {
            model_id: "yolov7_qat",
            server_url: "http://localhost:8000",
            confidence_threshold: 0.4,
            draw_bounding_boxes: true,
            use_shared_memory: true,
            label_font_scale: 0.5,
            classes: ["car", "truck", "motorcycle", "bus", "bicycle"]
          }
        },
        {
          type: 'object_tracking',
          config: {
            frame_rate: 30,
            track_buffer: 30,
            track_thresh: 0.5,
            high_thresh: 0.6,
            match_thresh: 0.8,
            draw_tracking: true,
            draw_track_trajectory: true,
            draw_track_id: true,
            draw_semi_transparent_boxes: true,
            label_font_scale: 0.6
          }
        },
        {
          type: 'line_zone_manager',
          config: {
            draw_zones: true,
            line_color: [255, 255, 255],
            line_thickness: 2,
            draw_counts: true,
            text_color: [0, 0, 0],
            text_scale: 0.5,
            text_thickness: 2,
            zones: [{
              id: "traffic_line",
              start_x: 0.1,
              start_y: 0.5,
              end_x: 0.9,
              end_y: 0.5,
              min_crossing_threshold: 1,
              triggering_anchors: ["BOTTOM_CENTER", "CENTER"]
            }]
          }
        }
      ],
      sinks: [
        {
          type: 'database',
          config: {
            store_thumbnails: false,
            thumbnail_width: 320,
            thumbnail_height: 180,
            retention_days: 30,
            store_detection_events: false,
            store_tracking_events: true,
            store_counting_events: true
          }
        }
      ]
    }
  }
]; 