import React from 'react';
import {
  Alert,
  AlertTitle,
  Box,
  Button,
  Typography,
  Chip,
  Stack
} from '@mui/material';
import {
  Upgrade as UpgradeIcon,
  Warning as WarningIcon,
  Info as InfoIcon
} from '@mui/icons-material';
import { CameraLicenseStatus, TenantInfo } from '../../services/api';

interface LicenseExceptionHandlerProps {
  licenseStatus: CameraLicenseStatus | null;
  tenantInfo: TenantInfo | null;
  error?: string | null;
  onUpgrade?: () => void;
  showDetails?: boolean;
}

const LicenseExceptionHandler: React.FC<LicenseExceptionHandlerProps> = ({
  licenseStatus,
  tenantInfo,
  error,
  onUpgrade,
  showDetails = true
}) => {
  // Handle trial limit exceeded error
  if (error && error.includes('Trial camera limit exceeded')) {
    return (
      <Alert severity="warning" sx={{ mb: 2 }}>
        <AlertTitle>
          <Box display="flex" alignItems="center" gap={1}>
            <WarningIcon />
            Trial Limit Reached
          </Box>
        </AlertTitle>
        <Typography variant="body2" sx={{ mb: 2 }}>
          You've reached the maximum of {licenseStatus?.trial_limit || 2} cameras for your trial account.
          Upgrade to a Base License for unlimited cameras.
        </Typography>
        <Box display="flex" gap={2} alignItems="center">
          <Typography variant="h6" color="primary" sx={{ fontWeight: 'bold' }}>
            $60/camera/month
          </Typography>
          {onUpgrade && (
            <Button
              variant="contained"
              startIcon={<UpgradeIcon />}
              onClick={onUpgrade}
              size="small"
            >
              Upgrade Now
            </Button>
          )}
        </Box>
      </Alert>
    );
  }

  // Handle general license errors
  if (error) {
    return (
      <Alert severity="error" sx={{ mb: 2 }}>
        <AlertTitle>License Error</AlertTitle>
        <Typography variant="body2">{error}</Typography>
        {onUpgrade && (
          <Box sx={{ mt: 1 }}>
            <Button
              variant="outlined"
              startIcon={<UpgradeIcon />}
              onClick={onUpgrade}
              size="small"
            >
              Manage License
            </Button>
          </Box>
        )}
      </Alert>
    );
  }

  // Show license status information if requested
  if (showDetails && licenseStatus) {
    const trialCamerasCount = licenseStatus.trial_cameras;
    const totalCamerasCount = licenseStatus.camera_count;
    const baseLicenseCameras = totalCamerasCount - trialCamerasCount;
    const isTrialAccount = trialCamerasCount > 0;

    return (
      <Alert 
        severity={licenseStatus.is_trial_limit_exceeded ? "warning" : "info"} 
        sx={{ mb: 2 }}
      >
        <AlertTitle>
          <Box display="flex" alignItems="center" gap={1}>
            <InfoIcon />
            Camera Licensing Status
            {tenantInfo?.type === 'vendor' && (
              <Chip 
                label="White-Label Account" 
                size="small" 
                color="secondary"
                sx={{ ml: 1 }}
              />
            )}
          </Box>
        </AlertTitle>
        
        <Stack spacing={1} sx={{ mt: 1 }}>
          <Box display="flex" gap={2} flexWrap="wrap">
            {isTrialAccount && (
              <Chip
                label={`${trialCamerasCount} Trial Camera${trialCamerasCount !== 1 ? 's' : ''}`}
                color="warning"
                size="small"
              />
            )}
            {baseLicenseCameras > 0 && (
              <Chip
                label={`${baseLicenseCameras} Licensed Camera${baseLicenseCameras !== 1 ? 's' : ''}`}
                color="success"
                size="small"
              />
            )}
            <Chip
              label={`${totalCamerasCount} Total`}
              variant="outlined"
              size="small"
            />
          </Box>

          {isTrialAccount && (
            <Typography variant="body2" color="text.secondary">
              Trial limit: {trialCamerasCount}/{licenseStatus.trial_limit} cameras used
              {licenseStatus.is_trial_limit_exceeded && (
                <Typography component="span" color="warning.main" sx={{ ml: 1 }}>
                  (Limit reached)
                </Typography>
              )}
            </Typography>
          )}

          {tenantInfo?.wholesale_discount && (
            <Typography variant="body2" color="success.main">
              White-label discount: {Math.round(tenantInfo.wholesale_discount * 100)}% off
            </Typography>
          )}

          {isTrialAccount && onUpgrade && (
            <Box sx={{ mt: 1 }}>
              <Typography variant="body2" sx={{ mb: 1 }}>
                Upgrade to Base License for unlimited cameras at $60/camera/month
              </Typography>
              <Button
                variant="contained"
                startIcon={<UpgradeIcon />}
                onClick={onUpgrade}
                size="small"
              >
                Upgrade License
              </Button>
            </Box>
          )}
        </Stack>
      </Alert>
    );
  }

  return null;
};

export default LicenseExceptionHandler;
