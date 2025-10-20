import React from 'react';
import {
  Card,
  CardContent,
  Typography,
  Box,
  Chip,
  Stack,
  Button,
  LinearProgress
} from '@mui/material';
import {
  Videocam as VideocamIcon,
  Upgrade as UpgradeIcon,
  Security as SecurityIcon
} from '@mui/icons-material';
import { CameraLicenseStatus, TenantInfo } from '../../services/api';

interface LicenseStatusCardProps {
  licenseStatus: CameraLicenseStatus | null;
  tenantInfo: TenantInfo | null;
  onUpgrade?: () => void;
  loading?: boolean;
}

const LicenseStatusCard: React.FC<LicenseStatusCardProps> = ({
  licenseStatus,
  tenantInfo,
  onUpgrade,
  loading = false
}) => {
  if (loading) {
    return (
      <Card sx={{ mb: 3 }}>
        <CardContent>
          <Box display="flex" alignItems="center" gap={2} mb={2}>
            <SecurityIcon color="primary" />
            <Typography variant="h6">License Status</Typography>
          </Box>
          <LinearProgress />
          <Typography variant="body2" color="text.secondary" sx={{ mt: 1 }}>
            Loading license information...
          </Typography>
        </CardContent>
      </Card>
    );
  }

  if (!licenseStatus) {
    return null;
  }

  const trialCamerasCount = licenseStatus.trial_cameras;
  const totalCamerasCount = licenseStatus.camera_count;
  const baseLicenseCameras = totalCamerasCount - trialCamerasCount;
  const isTrialAccount = trialCamerasCount > 0;
  const trialProgress = (trialCamerasCount / licenseStatus.trial_limit) * 100;

  return (
    <Card sx={{ mb: 3 }}>
      <CardContent>
        <Box display="flex" alignItems="center" justifyContent="space-between" mb={2}>
          <Box display="flex" alignItems="center" gap={2}>
            <SecurityIcon color="primary" />
            <Typography variant="h6">License Status</Typography>
            {tenantInfo?.type === 'vendor' && (
              <Chip 
                label="White-Label" 
                size="small" 
                color="secondary"
              />
            )}
          </Box>
          {isTrialAccount && onUpgrade && (
            <Button
              variant="outlined"
              startIcon={<UpgradeIcon />}
              onClick={onUpgrade}
              size="small"
            >
              Upgrade
            </Button>
          )}
        </Box>

        <Stack spacing={2}>
          {/* Camera Count Summary */}
          <Box display="flex" alignItems="center" gap={2}>
            <VideocamIcon color="action" />
            <Typography variant="body1">
              {totalCamerasCount} Camera{totalCamerasCount !== 1 ? 's' : ''} Total
            </Typography>
          </Box>

          {/* License Breakdown */}
          <Stack direction="row" spacing={1} flexWrap="wrap">
            {isTrialAccount && (
              <Chip
                label={`${trialCamerasCount} Trial`}
                color="warning"
                size="small"
                variant={licenseStatus.is_trial_limit_exceeded ? "filled" : "outlined"}
              />
            )}
            {baseLicenseCameras > 0 && (
              <Chip
                label={`${baseLicenseCameras} Licensed`}
                color="success"
                size="small"
              />
            )}
          </Stack>

          {/* Trial Progress */}
          {isTrialAccount && (
            <Box>
              <Box display="flex" justifyContent="space-between" alignItems="center" mb={1}>
                <Typography variant="body2" color="text.secondary">
                  Trial Usage
                </Typography>
                <Typography variant="body2" color="text.secondary">
                  {trialCamerasCount}/{licenseStatus.trial_limit}
                </Typography>
              </Box>
              <LinearProgress
                variant="determinate"
                value={trialProgress}
                color={licenseStatus.is_trial_limit_exceeded ? "warning" : "primary"}
                sx={{ height: 8, borderRadius: 4 }}
              />
              {licenseStatus.is_trial_limit_exceeded && (
                <Typography variant="body2" color="warning.main" sx={{ mt: 1 }}>
                  Trial limit reached. Upgrade for unlimited cameras.
                </Typography>
              )}
            </Box>
          )}

          {/* White-label Discount */}
          {tenantInfo?.wholesale_discount && (
            <Box>
              <Typography variant="body2" color="success.main">
                <strong>White-label Discount:</strong> {Math.round(tenantInfo.wholesale_discount * 100)}% off
              </Typography>
            </Box>
          )}

          {/* Pricing Information */}
          {isTrialAccount && (
            <Box 
              sx={{ 
                bgcolor: 'primary.50', 
                p: 2, 
                borderRadius: 1,
                border: '1px solid',
                borderColor: 'primary.200'
              }}
            >
              <Typography variant="body2" color="primary.main" sx={{ fontWeight: 'medium' }}>
                Base License: $60/camera/month for unlimited cameras
              </Typography>
            </Box>
          )}
        </Stack>
      </CardContent>
    </Card>
  );
};

export default LicenseStatusCard;
