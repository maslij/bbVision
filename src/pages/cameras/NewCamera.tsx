import { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import {
  Container,
  Typography,
  Box,
  TextField,
  Button,
  Paper,
  Alert,
  CircularProgress,
  Divider
} from '@mui/material';
import ArrowBackIcon from '@mui/icons-material/ArrowBack';
import VideocamIcon from '@mui/icons-material/Videocam';

import apiService, { CameraInput, CameraLicenseStatus, TenantInfo } from '../../services/api';
import LicenseExceptionHandler from '../../components/licensing/LicenseExceptionHandler';

const NewCamera = () => {
  const navigate = useNavigate();
  const [cameraData, setCameraData] = useState<CameraInput>({
    name: '',
    tenant_id: 'default' // Default tenant for now
  });
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [licenseStatus, setLicenseStatus] = useState<CameraLicenseStatus | null>(null);
  const [tenantInfo, setTenantInfo] = useState<TenantInfo | null>(null);
  const [licenseLoading, setLicenseLoading] = useState(true);

  // Load license status on component mount
  useEffect(() => {
    const loadLicenseStatus = async () => {
      try {
        const [licenseData, tenantData] = await Promise.all([
          apiService.license.getCameraLicenseStatus(cameraData.tenant_id),
          apiService.license.getTenantInfo(cameraData.tenant_id)
        ]);
        
        setLicenseStatus(licenseData);
        setTenantInfo(tenantData);
      } catch (err) {
        console.error('Error loading license status:', err);
      } finally {
        setLicenseLoading(false);
      }
    };

    loadLicenseStatus();
  }, [cameraData.tenant_id]);

  const handleChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const { name, value } = e.target;
    setCameraData(prev => ({
      ...prev,
      [name]: value
    }));
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setLoading(true);
    setError(null);

    // Check trial limits before attempting to create camera
    if (licenseStatus?.is_trial_limit_exceeded) {
      setError(`Trial camera limit exceeded. Upgrade to Base License ($60/cam/mo) for unlimited cameras.`);
      setLoading(false);
      return;
    }

    try {
      const response = await apiService.cameras.create(cameraData);
      if (response) {
        navigate(`/cameras/${response.id}/pipeline`);
      } else {
        setError('Failed to create camera. Please try again.');
      }
    } catch (err: any) {
      console.error('Error creating camera:', err);
      
      // Handle license-specific errors
      if (err.response?.status === 400 && err.response?.data?.message) {
        const errorMessage = err.response.data.message;
        if (errorMessage.includes('Trial camera limit exceeded')) {
          setError(errorMessage);
        } else if (errorMessage.includes('license')) {
          setError(errorMessage);
        } else {
          setError('Failed to create camera. Please try again.');
        }
      } else {
        setError('Failed to create camera. Please check your connection and try again.');
      }
    } finally {
      setLoading(false);
    }
  };

  const handleUpgrade = () => {
    navigate('/license');
  };

  return (
    <Container maxWidth="md" sx={{ mt: 4, mb: 4 }}>
      <Box sx={{ mb: 4 }}>
        <Button
          startIcon={<ArrowBackIcon />}
          onClick={() => navigate('/')}
          sx={{ mb: 2 }}
        >
          Back to Dashboard
        </Button>
        <Typography variant="h4" component="h1" gutterBottom>
          Create New Camera
        </Typography>
      </Box>

      {/* License Status Loading */}
      {licenseLoading && (
        <Alert severity="info" sx={{ mb: 3 }}>
          <Box display="flex" alignItems="center" gap={2}>
            <CircularProgress size={20} />
            <Typography>Checking license status...</Typography>
          </Box>
        </Alert>
      )}

      {/* License Information */}
      {!licenseLoading && (
        <LicenseExceptionHandler
          licenseStatus={licenseStatus}
          tenantInfo={tenantInfo}
          error={error}
          onUpgrade={handleUpgrade}
          showDetails={true}
        />
      )}

      {error && !error.includes('Trial camera limit exceeded') && (
        <Alert severity="error" sx={{ mb: 3 }} onClose={() => setError(null)}>
          {error}
        </Alert>
      )}

      <Paper sx={{ p: 4 }}>
        <form onSubmit={handleSubmit}>
          <Box
            display="flex"
            flexDirection="column"
            gap={3}
          >
            <Box display="flex" justifyContent="center" mb={2}>
              <VideocamIcon sx={{ fontSize: 60, color: 'primary.main' }} />
            </Box>
            <TextField
              required
              fullWidth
              id="name"
              name="name"
              label="Camera Name"
              value={cameraData.name || ''}
              onChange={handleChange}
              disabled={loading}
              placeholder="Enter a descriptive name for this camera"
            />
            <Box sx={{ mt: 3, display: 'flex', justifyContent: 'space-between' }}>
              <Button
                variant="outlined"
                onClick={() => navigate('/')}
                disabled={loading}
              >
                Cancel
              </Button>
              <Button
                type="submit"
                variant="contained"
                color="primary"
                disabled={
                  loading || 
                  !(cameraData.name?.trim()) || 
                  licenseLoading ||
                  licenseStatus?.is_trial_limit_exceeded
                }
                startIcon={loading && <CircularProgress size={20} color="inherit" />}
              >
                {loading ? 'Creating...' : 
                 licenseStatus?.is_trial_limit_exceeded ? 'Trial Limit Reached' :
                 'Create Camera'}
              </Button>
            </Box>
          </Box>
        </form>
      </Paper>
    </Container>
  );
};

export default NewCamera; 