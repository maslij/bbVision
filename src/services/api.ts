import axios from 'axios';

// Extend Axios config to include our custom metadata
declare module 'axios' {
  interface InternalAxiosRequestConfig {
    metadata?: {
      startTime: number;
      startTimestamp: number;
    };
  }
}

// DEPRECATED: Use getFullUrl() instead of API_URL directly
// This remains empty for backwards compatibility
const API_URL = '';

// Performance monitoring configuration
interface ApiPerformanceConfig {
  enabled: boolean;
  logToConsole: boolean;
  logSlowRequests: boolean;
  slowRequestThreshold: number; // milliseconds
  trackMetrics: boolean;
}

interface ApiCallMetrics {
  url: string;
  method: string;
  duration: number;
  status: number;
  timestamp: number;
  size?: number;
  error?: string;
}

// Global performance configuration
const performanceConfig: ApiPerformanceConfig = {
  enabled: true,
  logToConsole: true,
  logSlowRequests: true,
  slowRequestThreshold: 1000, // 1 second
  trackMetrics: true
};

// Metrics storage for analysis
const apiMetrics: ApiCallMetrics[] = [];
const MAX_METRICS_STORAGE = 1000; // Keep last 1000 requests

// Performance monitoring utilities
const ApiPerformanceMonitor = {
  // Configure monitoring settings
  configure: (config: Partial<ApiPerformanceConfig>) => {
    Object.assign(performanceConfig, config);
  },

  // Get current configuration
  getConfig: () => ({ ...performanceConfig }),

  // Get collected metrics
  getMetrics: () => [...apiMetrics],

  // Get performance summary
  getSummary: () => {
    if (apiMetrics.length === 0) return null;

    const durations = apiMetrics.map(m => m.duration);
    const errors = apiMetrics.filter(m => m.error || m.status >= 400);
    
    return {
      totalRequests: apiMetrics.length,
      averageDuration: durations.reduce((a, b) => a + b, 0) / durations.length,
      minDuration: Math.min(...durations),
      maxDuration: Math.max(...durations),
      p95Duration: durations.sort((a, b) => a - b)[Math.floor(durations.length * 0.95)],
      errorRate: (errors.length / apiMetrics.length) * 100,
      slowRequests: apiMetrics.filter(m => m.duration > performanceConfig.slowRequestThreshold).length,
      endpointBreakdown: apiMetrics.reduce((acc, metric) => {
        const endpoint = metric.url.replace(/\/\d+/g, '/:id'); // Normalize IDs
        if (!acc[endpoint]) {
          acc[endpoint] = { count: 0, totalDuration: 0, errors: 0 };
        }
        acc[endpoint].count++;
        acc[endpoint].totalDuration += metric.duration;
        if (metric.error || metric.status >= 400) acc[endpoint].errors++;
        return acc;
      }, {} as Record<string, { count: number; totalDuration: number; errors: number }>)
    };
  },

  // Clear collected metrics
  clearMetrics: () => {
    apiMetrics.length = 0;
  },

  // Export metrics as CSV for external analysis
  exportToCsv: () => {
    if (apiMetrics.length === 0) return '';
    
    const headers = ['timestamp', 'method', 'url', 'duration', 'status', 'size', 'error'];
    const rows = apiMetrics.map(m => [
      new Date(m.timestamp).toISOString(),
      m.method,
      m.url,
      m.duration,
      m.status,
      m.size || '',
      m.error || ''
    ]);
    
    return [headers, ...rows].map(row => row.join(',')).join('\n');
  }
};

// Add performance monitoring to axios instance
axios.interceptors.request.use(
  (config) => {
    if (performanceConfig.enabled) {
      // Add timing start to request config
      config.metadata = {
        startTime: performance.now(),
        startTimestamp: Date.now()
      };
    }
    return config;
  },
  (error) => {
    return Promise.reject(error);
  }
);

axios.interceptors.response.use(
  (response) => {
    if (performanceConfig.enabled && response.config.metadata) {
      const duration = performance.now() - response.config.metadata.startTime;
      const size = response.data ? JSON.stringify(response.data).length : 0;
      
      const metrics: ApiCallMetrics = {
        url: response.config.url || '',
        method: (response.config.method || 'GET').toUpperCase(),
        duration: Math.round(duration * 100) / 100, // Round to 2 decimal places
        status: response.status,
        timestamp: response.config.metadata.startTimestamp,
        size
      };

      // Store metrics
      if (performanceConfig.trackMetrics) {
        apiMetrics.push(metrics);
        // Keep only the last MAX_METRICS_STORAGE entries
        if (apiMetrics.length > MAX_METRICS_STORAGE) {
          apiMetrics.shift();
        }
      }

      // Console logging
      if (performanceConfig.logToConsole) {
        const isSlowRequest = duration > performanceConfig.slowRequestThreshold;
        
        if (performanceConfig.logSlowRequests && isSlowRequest) {
          console.warn(
            `🐌 SLOW API CALL: ${metrics.method} ${metrics.url}`,
            `\n⏱️  Duration: ${duration.toFixed(2)}ms`,
            `\n📊 Status: ${metrics.status}`,
            `\n📦 Size: ${(size / 1024).toFixed(2)}KB`,
            `\n🕐 Time: ${new Date(metrics.timestamp).toISOString()}`
          );
        } else {
          console.log(
            `🌐 API: ${metrics.method} ${metrics.url} - ${duration.toFixed(2)}ms - ${metrics.status}`
          );
        }
      }
    }
    return response;
  },
  (error) => {
    if (performanceConfig.enabled && error.config?.metadata) {
      const duration = performance.now() - error.config.metadata.startTime;
      const status = error.response?.status || 0;
      
      const metrics: ApiCallMetrics = {
        url: error.config.url || '',
        method: (error.config.method || 'GET').toUpperCase(),
        duration: Math.round(duration * 100) / 100,
        status,
        timestamp: error.config.metadata.startTimestamp,
        error: error.message
      };

      // Store metrics
      if (performanceConfig.trackMetrics) {
        apiMetrics.push(metrics);
        if (apiMetrics.length > MAX_METRICS_STORAGE) {
          apiMetrics.shift();
        }
      }

      // Console logging for errors
      if (performanceConfig.logToConsole) {
        console.error(
          `❌ API ERROR: ${metrics.method} ${metrics.url}`,
          `\n⏱️  Duration: ${duration.toFixed(2)}ms`,
          `\n📊 Status: ${status}`,
          `\n💥 Error: ${error.message}`,
          `\n🕐 Time: ${new Date(metrics.timestamp).toISOString()}`
        );
      }
    }
    return Promise.reject(error);
  }
);

// Helper function to ensure response is an array
const ensureArray = (data: any): any[] => {
  if (!data) {
    return [];
  }
  return Array.isArray(data) ? data : [data];
};

// Get the full URL with the actual origin for embedded images
const getFullUrl = (path: string): string => {
  // For development with the proxy, we use relative URLs
  if (window.location.hostname === 'localhost') {
    // When using Vite's built-in proxy, we should use relative URLs
    // The proxy in vite.config.ts will forward /api requests to the backend
    // If proxy is not working, connect directly to the API server
    const apiServer = import.meta.env.VITE_TAPI_SERVER || 'localhost:8090';
    return `http://${apiServer}${path}`;
  }
  
  // For production, we need to use the actual API server
  // You might need to configure this based on your deployment setup
  const apiBaseUrl = window.location.origin; // Use the same origin in production
  return `${apiBaseUrl}${path}`;
};

// Get billing server URL
// In development mode, calls billing server directly
// In production mode, routes through tAPI gateway
const getBillingUrl = (path: string): string => {
  const apiMode = import.meta.env.VITE_API_MODE || 'development';
  const billingServer = import.meta.env.VITE_BILLING_SERVER || 'http://localhost:8081';
  
  // In development, call billing server directly
  if (apiMode === 'development' && window.location.hostname === 'localhost') {
    return `${billingServer}${path}`;
  }
  
  // In production, route through tAPI gateway
  // (tAPI will proxy /api/v1/billing/* to the billing server)
  return getFullUrl(path);
};

// Camera interface to match the API response
export interface Camera {
  id: string;
  name: string;
  running: boolean;
  components?: {
    source: number;
    processors: number;
    sinks: number;
  };
}

// Stream interface for StreamCard and other components
export interface Stream {
  id: string;
  name: string;
  status: string;
  type?: string;
  width?: number;
  height?: number;
  pipeline?: {
    nodes: {
      id: string;
      componentId: string;
      name: string;
    }[];
  };
}

// Point interface for zone configuration
export interface Point {
  x: number;
  y: number;
}

// Polygon interface
export interface Polygon {
  id: string;
  name: string;
  points: Point[];
}

// CreatePolygonPayload interface
export interface CreatePolygonPayload {
  name: string;
  points: Point[];
}

// UpdatePolygonPayload interface
export interface UpdatePolygonPayload {
  id: string;
  name?: string;
  points?: Point[];
}

// AlarmEvent interface
export interface AlarmEvent {
  id: string;
  timestamp: number;
  objectClass?: string;
  confidence?: number;
  message?: string;
  image_data?: string;
}

// Camera creation/update interface
export interface CameraInput {
  id?: string;
  name?: string;
  running?: boolean;
  tenant_id?: string; // New field for per-camera licensing
}

// ===== NEW BILLING SYSTEM TYPES =====
// New billing types for the enhanced pricing model
export interface LicenseStatus {
  license_mode: 'trial' | 'base' | 'unlicensed';
  is_valid: boolean;
  active_cameras: number;
  cameras_allowed: number | null; // null = unlimited
  trial_max_cameras: number;
  days_remaining: number | null; // null if not trial
  valid_until: string;
  enabled_growth_packs: string[];
  cameras: Array<{
    camera_id: string;
    tenant_id: string;
    mode: 'trial' | 'base' | 'unlicensed';
    start_date: string;
    end_date: string;
    enabled_growth_packs: string[];
  }>;
}

export interface SubscriptionInfo {
  subscription_id: string;
  tenant_id: string;
  plan: 'trial' | 'base';
  status: 'active' | 'expired' | 'cancelled';
  cameras_licensed: number;
  growth_packs: Array<{
    pack_id: string;
    pack_name: string;
    enabled_at: string;
    price_monthly: number;
  }>;
  billing_cycle: 'monthly' | 'annual';
  next_billing_date: string;
  total_monthly_cost: number;
}

export interface GrowthPackInfo {
  pack_id: string;
  pack_name: string;
  description: string;
  category: 'analytics' | 'intelligence' | 'data' | 'integration';
  price_monthly: number;
  features: string[];
  is_enabled: boolean;
}

export interface UsageSummary {
  tenant_id: string;
  period_start: string;
  period_end: string;
  api_calls: number;
  llm_tokens_used: number;
  storage_gb_days: number;
  sms_sent: number;
  agent_executions: number;
}

// ===== LEGACY TYPES (For backwards compatibility) =====
// Per-camera license status interface
export interface CameraLicenseStatus {
  camera_count: number;
  trial_limit: number;
  trial_cameras: number;
  is_trial_limit_exceeded: boolean;
  cameras: Array<{
    camera_id: string;
    tenant_id: string;
    mode: 'FREE_TRIAL' | 'BASE_LICENSE' | 'UNLICENSED';
    is_trial: boolean;
    start_date: string;
    end_date: string;
    enabled_growth_packs: string[];
  }>;
}

// Tenant information interface
export interface TenantInfo {
  tenant_id: string;
  name?: string;
  type?: 'standard' | 'vendor'; // vendor for white-label
  wholesale_discount?: number;
}

// License update interface (kept for any remaining legacy usage)
export interface LicenseUpdate {
  license_key: string;
  owner?: string;
  email?: string;
}

// Component types interface
export interface ComponentTypes {
  sources: string[];
  processors: string[];
  sinks: string[];
  
  // License tier information
  current_tier?: number;
  current_tier_name?: string;
  
  // Permissions information by component category and type
  permissions?: {
    source: Record<string, boolean>;
    processor: Record<string, boolean>;
    sink: Record<string, boolean>;
  };
  
  // Dependencies between components
  dependencies?: {
    [key: string]: string[];
  };
  dependency_rules?: string[];
}

// Generic component interface
export interface Component {
  id: string;
  type: string | number;
  type_name?: string;
  running: boolean;
  config: any;
  
  // Properties that might be directly on the component object rather than in config
  // Source component properties
  url?: string;
  width?: number;
  height?: number;
  fps?: number;
  target_fps?: number;
  hardware_acceleration?: string;
  adaptive_timing?: string;
  rtsp_transport?: string;
  latency?: number;
  
  // Processor component properties
  model_id?: string;
  server_url?: string;
  confidence_threshold?: number;
  draw_bounding_boxes?: boolean;
  use_shared_memory?: boolean;
  classes?: string[];
  processed_frames?: number;
  detection_count?: number;
  label_font_scale?: number;
  
  // Object tracking properties
  frame_rate?: number;
  track_buffer?: number;
  track_thresh?: number;
  high_thresh?: number;
  match_thresh?: number;
  draw_tracking?: boolean;
  draw_track_id?: boolean;
  draw_track_trajectory?: boolean;
  draw_semi_transparent_boxes?: boolean;
  
  // Line zone properties
  draw_zones?: boolean;
  line_color?: number[];
  line_thickness?: number;
  draw_counts?: boolean;
  text_color?: number[];
  text_scale?: number;
  text_thickness?: number;
  zones?: any[];
  
  // Sink component properties
  file_path?: string;
  path?: string;
  fourcc?: string;
  resolution?: {
    width: number;
    height: number;
  };
}

// Component input interface
export interface ComponentInput {
  id?: string;
  type: string;
  config: any;
}

// Add the missing interfaces and database API methods to the file.
// First, let's add interfaces for database records

export interface FrameRecord {
  id: number;
  timestamp: number;
  thumbnail?: string;
  created_at: number;
}

export interface EventRecord {
  id: number;
  frame_id: number;
  type: number;
  source_id: string;
  camera_id: string;
  timestamp: number;
  properties: any; // Changed from string to any to support JSON objects
  created_at: number;
}



// Update interfaces for telemetry data
export interface ZoneLineCount {
  timestamp: number;
  zone_id: string;
  direction: string;
  count: number;
}

export interface ZoneLineCountsResponse {
  zone_line_counts: ZoneLineCount[];
  success?: boolean;
  has_data?: boolean;
  error?: string;
}

export interface ClassHeatmapPoint {
  x: number;
  y: number;
  value: number;
  class: string;
}

export interface ClassHeatmapResponse {
  class_heatmap_data: ClassHeatmapPoint[];
  success?: boolean;
  has_data?: boolean;
  error?: string;
}

// Add Task interfaces
export interface Task {
  id: string;
  type: string;
  target_id: string;
  state: 'pending' | 'running' | 'completed' | 'failed';
  progress: number;
  message: string;
  created_at: number;
  updated_at: number;
}

// API Service
const apiService = {
  // New billing API methods
  billing: {
    // Get license status for a tenant
    getLicenseStatus: async (tenantId: string): Promise<LicenseStatus | null> => {
      try {
        const response = await axios.get(getBillingUrl(`/api/v1/billing/license/${tenantId}`));
        return response.data;
      } catch (error) {
        console.error('Error getting license status:', error);
        return null;
      }
    },

    // Get subscription information
    getSubscription: async (tenantId: string): Promise<SubscriptionInfo | null> => {
      try {
        const response = await axios.get(getBillingUrl(`/api/v1/billing/subscription/${tenantId}`));
        return response.data;
      } catch (error) {
        console.error('Error getting subscription:', error);
        return null;
      }
    },

    // Get enabled growth packs
    getEnabledGrowthPacks: async (tenantId: string): Promise<string[] | null> => {
      try {
        const response = await axios.get(getBillingUrl(`/api/v1/billing/growth-packs/${tenantId}`));
        return response.data.enabled_packs || [];
      } catch (error) {
        console.error('Error getting growth packs:', error);
        return [];
      }
    },

    // Get all available growth packs
    getAvailableGrowthPacks: async (): Promise<GrowthPackInfo[]> => {
      try {
        const response = await axios.get(getBillingUrl(`/api/v1/billing/growth-packs/available`));
        return response.data.packs || [];
      } catch (error) {
        console.error('Error getting available growth packs:', error);
        return [];
      }
    },

    // Get usage summary
    getUsageSummary: async (tenantId: string, periodStart?: string, periodEnd?: string): Promise<UsageSummary | null> => {
      try {
        const params = new URLSearchParams();
        if (periodStart) params.append('start', periodStart);
        if (periodEnd) params.append('end', periodEnd);
        
        const response = await axios.get(getBillingUrl(`/api/v1/billing/usage/${tenantId}?${params.toString()}`));
        return response.data;
      } catch (error) {
        console.error('Error getting usage summary:', error);
        return null;
      }
    },

    // Validate camera license
    validateCameraLicense: async (cameraId: string, tenantId: string): Promise<boolean> => {
      try {
        const response = await axios.post(getBillingUrl(`/api/v1/billing/validate`), {
          camera_id: cameraId,
          tenant_id: tenantId
        });
        return response.data.is_valid || false;
      } catch (error) {
        console.error('Error validating camera license:', error);
        return false;
      }
    }
  },

  // Per-camera license API calls (LEGACY - kept for backwards compatibility)
  license: {
    getCameraLicenseStatus: async (tenant_id: string = 'default'): Promise<CameraLicenseStatus | null> => {
      try {
        const response = await axios.get(getFullUrl(`/api/v1/license/cameras?tenant_id=${tenant_id}`));
        return response.data;
      } catch (error) {
        console.error('Error getting camera license status:', error);
        return null;
      }
    },

    // Get tenant information
    getTenantInfo: async (tenant_id: string = 'default'): Promise<TenantInfo | null> => {
      try {
        const response = await axios.get(getFullUrl(`/api/v1/tenants/${tenant_id}`));
        return response.data;
      } catch (error) {
        console.error('Error getting tenant info:', error);
        return {
          tenant_id,
          name: 'Default Tenant',
          type: 'standard'
        };
      }
    }
  },

  // Camera related API calls
  cameras: {
    // Get all cameras
    getAll: async (): Promise<Camera[]> => {
      try {
        const response = await axios.get(getFullUrl('/api/v1/cameras'));
        return ensureArray(response.data);
      } catch (error) {
        console.error('Error fetching cameras:', error);
        return [];
      }
    },

    // Get a specific camera by ID
    getById: async (id: string): Promise<Camera | null> => {
      try {
        const response = await axios.get(getFullUrl(`/api/v1/cameras/${id}`));
        return response.data;
      } catch (error) {
        console.error(`Error fetching camera ${id}:`, error);
        return null;
      }
    },

    // Create a new camera
    create: async (cameraData: CameraInput): Promise<Camera | null> => {
      try {
        const response = await axios.post(getFullUrl('/api/v1/cameras'), cameraData);
        return response.data;
      } catch (error) {
        console.error('Error creating camera:', error);
        return null;
      }
    },

    // Update an existing camera
    update: async (id: string, cameraData: CameraInput): Promise<Camera | null> => {
      try {
        const response = await axios.put(getFullUrl(`/api/v1/cameras/${id}`), cameraData);
        return response.data;
      } catch (error) {
        console.error(`Error updating camera ${id}:`, error);
        return null;
      }
    },

    // Delete a camera
    delete: async (id: string, async: boolean = true): Promise<{success: boolean, databaseCleaned?: boolean, task_id?: string}> => {
      try {
        const response = await axios.delete(getFullUrl(`/api/v1/cameras/${id}${async ? '?async=true' : ''}`));
        return {
          success: true,
          databaseCleaned: response.data.database_cleaned,
          task_id: response.data.task_id
        };
      } catch (error) {
        console.error(`Error deleting camera ${id}:`, error);
        return { success: false };
      }
    },

    // Start a camera (convenience method)
    start: async (id: string): Promise<Camera | null> => {
      return apiService.cameras.update(id, { running: true });
    },

    // Stop a camera (convenience method)
    stop: async (id: string): Promise<Camera | null> => {
      return apiService.cameras.update(id, { running: false });
    },

    // Get the latest frame from a camera
    getFrame: (cameraId: string, quality: number = 90): string => {
      // Use relative path for frames too, to leverage the proxy
      return getFullUrl(`/api/v1/cameras/${cameraId}/frame?quality=${quality}`);
    }
  },

  // Component related API calls
  components: {
    // Get all available component types
    getTypes: async (): Promise<ComponentTypes | null> => {
      try {
        const response = await axios.get(getFullUrl('/api/v1/component-types'));
        return response.data;
      } catch (error) {
        console.error('Error fetching component types:', error);
        return null;
      }
    },

    // Get all components for a camera
    getAll: async (cameraId: string): Promise<{ source: Component | null, processors: Component[], sinks: Component[] } | null> => {
      try {
        const response = await axios.get(getFullUrl(`/api/v1/cameras/${cameraId}/components`));
        return response.data;
      } catch (error) {
        console.error(`Error fetching components for camera ${cameraId}:`, error);
        return null;
      }
    },

    // Source component operations
    source: {
      // Create a source component
      create: async (cameraId: string, componentData: ComponentInput): Promise<Component | null> => {
        try {
          const response = await axios.post(getFullUrl(`/api/v1/cameras/${cameraId}/source`), componentData);
          return response.data;
        } catch (error) {
          console.error(`Error creating source for camera ${cameraId}:`, error);
          return null;
        }
      },

      // Update a source component
      update: async (cameraId: string, componentData: Partial<ComponentInput>): Promise<Component | null> => {
        try {
          const response = await axios.put(getFullUrl(`/api/v1/cameras/${cameraId}/source`), componentData);
          return response.data;
        } catch (error) {
          console.error(`Error updating source for camera ${cameraId}:`, error);
          return null;
        }
      },

      // Delete a source component
      delete: async (cameraId: string): Promise<boolean> => {
        try {
          await axios.delete(getFullUrl(`/api/v1/cameras/${cameraId}/source`));
          return true;
        } catch (error) {
          console.error(`Error deleting source for camera ${cameraId}:`, error);
          return false;
        }
      },
    },

    // Processor component operations
    processors: {
      // Create a processor component
      create: async (cameraId: string, componentData: ComponentInput): Promise<Component | null> => {
        try {
          const response = await axios.post(getFullUrl(`/api/v1/cameras/${cameraId}/processors`), componentData);
          return response.data;
        } catch (error) {
          console.error(`Error creating processor for camera ${cameraId}:`, error);
          return null;
        }
      },

      // Get a specific processor component
      getById: async (cameraId: string, processorId: string): Promise<Component | null> => {
        try {
          const response = await axios.get(getFullUrl(`/api/v1/cameras/${cameraId}/processors/${processorId}`));
          return response.data;
        } catch (error) {
          console.error(`Error fetching processor ${processorId} for camera ${cameraId}:`, error);
          return null;
        }
      },

      // Update a processor component
      update: async (cameraId: string, processorId: string, componentData: { config: any }): Promise<Component | null> => {
        try {
          const response = await axios.put(getFullUrl(`/api/v1/cameras/${cameraId}/processors/${processorId}`), componentData);
          return response.data;
        } catch (error) {
          console.error(`Error updating processor ${processorId} for camera ${cameraId}:`, error);
          return null;
        }
      },

      // Delete a processor component
      delete: async (cameraId: string, processorId: string): Promise<boolean> => {
        try {
          await axios.delete(getFullUrl(`/api/v1/cameras/${cameraId}/processors/${processorId}`));
          return true;
        } catch (error) {
          console.error(`Error deleting processor ${processorId} for camera ${cameraId}:`, error);
          return false;
        }
      },
    },

    // Sink component operations
    sinks: {
      // Create a sink component
      create: async (cameraId: string, componentData: ComponentInput): Promise<Component | null> => {
        try {
          const response = await axios.post(getFullUrl(`/api/v1/cameras/${cameraId}/sinks`), componentData);
          return response.data;
        } catch (error) {
          console.error(`Error creating sink for camera ${cameraId}:`, error);
          return null;
        }
      },

      // Get a specific sink component
      getById: async (cameraId: string, sinkId: string): Promise<Component | null> => {
        try {
          const response = await axios.get(getFullUrl(`/api/v1/cameras/${cameraId}/sinks/${sinkId}`));
          return response.data;
        } catch (error) {
          console.error(`Error fetching sink ${sinkId} for camera ${cameraId}:`, error);
          return null;
        }
      },

      // Update a sink component
      update: async (cameraId: string, sinkId: string, componentData: { config: any }): Promise<Component | null> => {
        try {
          const response = await axios.put(getFullUrl(`/api/v1/cameras/${cameraId}/sinks/${sinkId}`), componentData);
          return response.data;
        } catch (error) {
          console.error(`Error updating sink ${sinkId} for camera ${cameraId}:`, error);
          return null;
        }
      },

      // Delete a sink component
      delete: async (cameraId: string, sinkId: string): Promise<boolean> => {
        try {
          await axios.delete(getFullUrl(`/api/v1/cameras/${cameraId}/sinks/${sinkId}`));
          return true;
        } catch (error) {
          console.error(`Error deleting sink ${sinkId} for camera ${cameraId}:`, error);
          return false;
        }
      },
    },
  },

  // Models and AI server status
  models: {
    // Get comprehensive model metadata including Triton server status
    getMetadata: async (): Promise<any> => {
      try {
        const response = await axios.get(getFullUrl('/api/v1/models/metadata'));
        return response.data;
      } catch (error) {
        console.error('Error fetching model metadata:', error);
        return null;
      }
    },

    // Legacy method for backward compatibility - now uses metadata endpoint
    getObjectDetectionModels: async (): Promise<any> => {
      try {
        const response = await axios.get(getFullUrl('/api/v1/models/metadata'));
        if (response.data) {
          // Transform the new format to match the old expected format
          return {
            models: response.data.models || [],
            triton_connected: response.data.triton_connected || false,
            triton_status: response.data.triton_status || 'unknown'
          };
        }
        return null;
      } catch (error) {
        console.error('Error fetching object detection models:', error);
        return null;
      }
    },
  },

  // Database and analytics service
  database: {
    /**
     * Get analytics summary for a camera
     */
    async getAnalytics(cameraId: string): Promise<any> {
      try {
        const response = await axios.get(getFullUrl(`/api/v1/cameras/${cameraId}/database/analytics`));
        return response.data;
      } catch (error) {
        console.error(`Error fetching analytics for camera ${cameraId}:`, error);
        return null;
      }
    },

    /**
     * Get time series data for a camera
     */
    async getTimeSeriesData(cameraId: string, timeRange?: {start: number, end: number}): Promise<any[]> {
      try {
        let url = `/api/v1/cameras/${cameraId}/database/time-series`;
        if (timeRange) {
          url += `?start_time=${timeRange.start}&end_time=${timeRange.end}`;
        }
        const response = await axios.get(getFullUrl(url));
        return response.data || [];
      } catch (error) {
        console.error(`Error fetching time series data for camera ${cameraId}:`, error);
        return [];
      }
    },

    /**
     * Get dwell time analytics for a camera
     */
    async getDwellTimeAnalytics(cameraId: string, timeRange?: {start: number, end: number}): Promise<any[]> {
      try {
        let url = `/api/v1/cameras/${cameraId}/database/dwell-time`;
        if (timeRange) {
          url += `?start_time=${timeRange.start}&end_time=${timeRange.end}`;
        }
        const response = await axios.get(getFullUrl(url));
        return response.data || [];
      } catch (error) {
        console.error(`Error fetching dwell time analytics for camera ${cameraId}:`, error);
        return [];
      }
    },

    /**
     * Get zone line counts for a specific camera with optional time range
     */
    async getZoneLineCounts(cameraId: string, timeRange?: {start: number, end: number}): Promise<ZoneLineCountsResponse | null> {
      try {
        let url = getFullUrl(`/api/v1/cameras/${cameraId}/database/zone-line-counts`);
        
        // Add time range parameters if they're set
        if (timeRange && timeRange.start > 0) {
          url += `?start_time=${timeRange.start}`;
          if (timeRange.end > 0) {
            url += `&end_time=${timeRange.end}`;
          }
        }
        
        const response = await fetch(url);
        
        // Handle 204 No Content response
        if (response.status === 204) {
          return {
            zone_line_counts: [],
            success: false,
            has_data: false,
            error: 'No zone line count data available'
          };
        }
        
        if (!response.ok) {
          throw new Error(`Failed to fetch zone line counts: ${response.statusText}`);
        }
        
        return await response.json();
      } catch (error) {
        console.error('Error fetching zone line counts:', error);
        return null;
      }
    },

    /**
     * Get class heatmap data for a specific camera
     */
    async getClassHeatmapData(cameraId: string): Promise<ClassHeatmapResponse | null> {
      try {
        const url = getFullUrl(`/api/v1/cameras/${cameraId}/database/class-heatmap`);
        
        const response = await fetch(url);
        
        // Handle 204 No Content response
        if (response.status === 204) {
          return {
            class_heatmap_data: [],
            success: false,
            has_data: false,
            error: 'No class heatmap data available'
          };
        }
        
        if (!response.ok) {
          throw new Error(`Failed to fetch class heatmap data: ${response.statusText}`);
        }
        
        return await response.json();
      } catch (error) {
        console.error('Error fetching class heatmap data:', error);
        return null;
      }
    },

    /**
     * Get heatmap image URL for a specific camera
     */
    getHeatmapImage(cameraId: string, params?: {
      anchor?: string;
      quality?: number;
      classes?: string[];
    }): string {
      // Start with base URL
      let url = getFullUrl(`/api/v1/cameras/${cameraId}/database/heatmap-image`);
      
      // Add query parameters if provided
      if (params) {
        const queryParams = new URLSearchParams();
        
        if (params.anchor) {
          queryParams.append('anchor', params.anchor);
        }
        
        if (params.quality !== undefined) {
          queryParams.append('quality', params.quality.toString());
        }
        
        if (params.classes && params.classes.length > 0) {
          queryParams.append('class', params.classes.join(','));
        }
        
        // Add timestamp for cache busting to force a fresh image every time
        queryParams.append('t', Date.now().toString());
        
        if (queryParams.toString()) {
          url += `?${queryParams.toString()}`;
        }
      } else {
        // Even with no other params, add a timestamp
        url += `?t=${Date.now()}`;
      }
      
      // Return the URL directly, as it will be used in an <img> tag
      return url;
    }
  },

  // Add tasks API
  tasks: {
    // Get all tasks
    getAll: async (): Promise<Task[]> => {
      try {
        const response = await axios.get(getFullUrl('/api/v1/tasks'));
        return response.data.tasks || [];
      } catch (error) {
        console.error('Error fetching tasks:', error);
        return [];
      }
    },

    // Get a specific task
    getById: async (id: string): Promise<Task | null> => {
      try {
        const response = await axios.get(getFullUrl(`/api/v1/tasks/${id}`));
        return response.data;
      } catch (error) {
        console.error(`Error fetching task ${id}:`, error);
        return null;
      }
    },

    // Poll a task until it completes or fails
    pollUntilComplete: async (
      id: string, 
      onProgress?: (task: Task) => void, 
      onError?: (error: any) => void,
      intervalMs: number = 1000,
      timeoutMs: number = 300000 // 5 minutes default timeout
    ): Promise<Task | null> => {
      const startTime = Date.now();
      let task: Task | null = null;
      let consecutiveErrors = 0;
      const maxConsecutiveErrors = 5; // Stop after 5 consecutive API errors
      
      while (Date.now() - startTime < timeoutMs) {
        try {
          task = await apiService.tasks.getById(id);
          consecutiveErrors = 0; // Reset error count on successful API call
          
          if (!task) {
            const error = new Error(`Task ${id} not found`);
            if (onError) onError(error);
            return null;
          }
          
          if (onProgress) {
            onProgress(task);
          }
          
          if (task.state === 'completed' || task.state === 'failed') {
            return task;
          }
          
          // Wait for the specified interval
          await new Promise(resolve => setTimeout(resolve, intervalMs));
          
        } catch (error) {
          consecutiveErrors++;
          console.error(`Error polling task ${id} (attempt ${consecutiveErrors}):`, error);
          
          if (consecutiveErrors >= maxConsecutiveErrors) {
            const errorMessage = `Stopped polling task ${id} after ${maxConsecutiveErrors} consecutive errors`;
            console.error(errorMessage);
            if (onError) onError(new Error(errorMessage));
            return task; // Return last known state
          }
          
          // Wait a bit longer after errors before retrying
          await new Promise(resolve => setTimeout(resolve, intervalMs * 2));
        }
      }
      
      // Handle timeout
      const timeoutError = new Error(`Task polling timed out after ${timeoutMs}ms`);
      console.warn(`Task ${id} polling timed out after ${timeoutMs}ms. Last known state:`, task?.state);
      if (onError) onError(timeoutError);
      
      return task; // Return the last known state if timeout occurs
    }
  },

  // Add stream frame utilities
  getFrameUrlWithTimestamp: (streamId: string, quality: number = 90): string => {
    const timestamp = Date.now();
    return getFullUrl(`/api/v1/streams/${streamId}/frame?quality=${quality}&t=${timestamp}`);
  },

  // Add stream and pipeline API functions
  getStreamById: async (streamId: string): Promise<Stream | null> => {
    try {
      const response = await axios.get(getFullUrl(`/api/v1/streams/${streamId}`));
      return response.data;
    } catch (error) {
      console.error(`Error fetching stream ${streamId}:`, error);
      return null;
    }
  },

  getStreamAlarms: async (streamId: string): Promise<AlarmEvent[]> => {
    try {
      const response = await axios.get(getFullUrl(`/api/v1/streams/${streamId}/alarms`));
      return response.data.alarms || [];
    } catch (error) {
      console.error(`Error fetching alarms for stream ${streamId}:`, error);
      return [];
    }
  },

  getPolygons: async (streamId: string): Promise<Polygon[]> => {
    try {
      const response = await axios.get(getFullUrl(`/api/v1/streams/${streamId}/polygons`));
      return response.data.polygons || [];
    } catch (error) {
      console.error(`Error fetching polygons for stream ${streamId}:`, error);
      return [];
    }
  },

  createPolygon: async (streamId: string, payload: CreatePolygonPayload): Promise<Polygon | null> => {
    try {
      const response = await axios.post(getFullUrl(`/api/v1/streams/${streamId}/polygons`), payload);
      return response.data;
    } catch (error) {
      console.error(`Error creating polygon for stream ${streamId}:`, error);
      return null;
    }
  },

  updatePolygon: async (streamId: string, payload: UpdatePolygonPayload): Promise<Polygon | null> => {
    try {
      const response = await axios.put(getFullUrl(`/api/v1/streams/${streamId}/polygons/${payload.id}`), payload);
      return response.data;
    } catch (error) {
      console.error(`Error updating polygon for stream ${streamId}:`, error);
      return null;
    }
  },

  deletePolygon: async (streamId: string, polygonId: string): Promise<boolean> => {
    try {
      await axios.delete(getFullUrl(`/api/v1/streams/${streamId}/polygons/${polygonId}`));
      return true;
    } catch (error) {
      console.error(`Error deleting polygon for stream ${streamId}:`, error);
      return false;
    }
  },

  hasPipelineComponent: async (streamId: string, componentType: string): Promise<boolean> => {
    try {
      const response = await axios.get(getFullUrl(`/api/v1/streams/${streamId}/pipeline/components/${componentType}`));
      return response.data.exists || false;
    } catch (error) {
      console.error(`Error checking for component ${componentType} in stream ${streamId}:`, error);
      return false;
    }
  },

  isPipelineProcessing: async (streamId: string): Promise<boolean> => {
    try {
      const response = await axios.get(getFullUrl(`/api/v1/streams/${streamId}/pipeline/status`));
      return response.data.processing || false;
    } catch (error) {
      console.error(`Error checking pipeline processing status for stream ${streamId}:`, error);
      return false;
    }
  },

  waitForPipelineProcessing: async (
    streamId: string, 
    onProgress?: (isProcessing: boolean) => void, 
    intervalMs: number = 1000,
    timeoutMs: number = 60000 // 1 minute default timeout
  ): Promise<boolean> => {
    const startTime = Date.now();
    
    while (Date.now() - startTime < timeoutMs) {
      const isProcessing = await apiService.isPipelineProcessing(streamId);
      
      if (onProgress) {
        onProgress(isProcessing);
      }
      
      if (!isProcessing) {
        return false; // Not processing anymore
      }
      
      // Wait for the specified interval
      await new Promise(resolve => setTimeout(resolve, intervalMs));
    }
    
    return true; // Still processing after timeout
  },

  getActivePipeline: async (streamId: string): Promise<string | null> => {
    try {
      const response = await axios.get(getFullUrl(`/api/v1/streams/${streamId}/pipeline/active`));
      return response.data.pipeline_id || null;
    } catch (error) {
      console.error(`Error getting active pipeline for stream ${streamId}:`, error);
      return null;
    }
  },

  getVisionModels: async (): Promise<any[]> => {
    try {
      const response = await axios.get(getFullUrl(`/api/v1/models/vision`));
      return response.data.models || [];
    } catch (error) {
      console.error('Error fetching vision models:', error);
      return [];
    }
  },

  checkServerHealth: async (): Promise<boolean> => {
    try {
      const response = await axios.get(getFullUrl(`/api/v1/health`));
      return response.data.status === 'ok';
    } catch (error) {
      console.error('Error checking server health:', error);
      return false;
    }
  },

  getWebSocketHost: (): string => {
    // Use the current host and just replace the protocol
    const wsProtocol = window.location.protocol === 'https:' ? 'wss:' : 'ws:';
    return `${wsProtocol}//${window.location.host}/ws`;
  }
};

// Export all the standalone functions
export const getStreamAlarms = apiService.getStreamAlarms;
export const hasPipelineComponent = apiService.hasPipelineComponent;
export const isPipelineProcessing = apiService.isPipelineProcessing;
export const waitForPipelineProcessing = apiService.waitForPipelineProcessing;
export const getActivePipeline = apiService.getActivePipeline;
export const getVisionModels = apiService.getVisionModels;

// Export performance monitoring utilities
export { ApiPerformanceMonitor };

export default apiService;