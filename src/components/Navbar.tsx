import { Link as RouterLink, useLocation } from 'react-router-dom';
import { useState, useEffect, useRef } from 'react';
import { useTheme } from '../contexts/ThemeContext';
import ThemeToggleIcon from './ThemeToggleIcon';
import LicenseBadge from './LicenseBadge';
import appConfig from '../utils/appConfig';
import {
  AppBar,
  Box,
  Toolbar,
  Typography,
  Button,
  IconButton,
  Container,
  Tooltip,
  Link,
  Chip,
  Badge
} from '@mui/material';
import VideocamIcon from '@mui/icons-material/Videocam';
import AddIcon from '@mui/icons-material/Add';
import VerifiedIcon from '@mui/icons-material/Verified';
import ErrorOutlineIcon from '@mui/icons-material/ErrorOutline';
import StarIcon from '@mui/icons-material/Star';
import DiamondIcon from '@mui/icons-material/Diamond';
import WorkspacePremiumIcon from '@mui/icons-material/WorkspacePremium';
import LockIcon from '@mui/icons-material/Lock';
import VpnKeyIcon from '@mui/icons-material/VpnKey';
import apiService, { CameraLicenseStatus } from '../services/api';
import { getVersionString } from '../utils/version';
import { LICENSE_CHANGED_EVENT } from '../pages/LicenseSetup';

// Get version display string
const VERSION_DISPLAY = getVersionString();

const Navbar = () => {
  const { theme, setTheme } = useTheme();
  const [cameraLicenseStatus, setCameraLicenseStatus] = useState<CameraLicenseStatus | null>(null);
  const [isLicenseLoaded, setIsLicenseLoaded] = useState<boolean>(false);
  const [checkingLicense, setCheckingLicense] = useState<boolean>(true);
  const location = useLocation();
  const previousPath = useRef<string>('');
  const licenseCheckTimer = useRef<number | null>(null);

  // Check license status immediately and then periodically
  const checkLicense = async () => {
    setCheckingLicense(true);
    try {
      const status = await apiService.license.getCameraLicenseStatus('default');
      setCameraLicenseStatus(status);
      setIsLicenseLoaded(true);
    } catch (err: any) {
      console.error('Error checking license:', err);
      setCameraLicenseStatus(null);
      setIsLicenseLoaded(false);
    } finally {
      setCheckingLicense(false);
    }
  };

  // Initial setup and periodic checks
  useEffect(() => {
    checkLicense();

    // Periodically check license status every minute
    const intervalId = setInterval(checkLicense, 60 * 1000);
    
    return () => {
      clearInterval(intervalId);
      // Also clear our visibilityChange timer if it exists
      if (licenseCheckTimer.current) {
        window.clearTimeout(licenseCheckTimer.current);
      }
    };
  }, []);
  
  // Listen for license change events from other components
  useEffect(() => {
    const handleLicenseChanged = () => {
      console.log('License change detected, refreshing status...');
      checkLicense();
    };
    
    // Add event listener for custom license change events
    document.addEventListener(LICENSE_CHANGED_EVENT, handleLicenseChanged);
    
    return () => {
      document.removeEventListener(LICENSE_CHANGED_EVENT, handleLicenseChanged);
    };
  }, []);

  // Check for page visibility changes to refresh license when user comes back to the app
  useEffect(() => {
    const handleVisibilityChange = () => {
      if (document.visibilityState === 'visible') {
        // Wait a short period after becoming visible before checking
        // This gives time for any backend changes to take effect
        if (licenseCheckTimer.current) {
          window.clearTimeout(licenseCheckTimer.current);
        }
        
        licenseCheckTimer.current = window.setTimeout(() => {
          checkLicense();
          licenseCheckTimer.current = null;
        }, 1000);
      }
    };
    
    document.addEventListener('visibilitychange', handleVisibilityChange);
    
    return () => {
      document.removeEventListener('visibilitychange', handleVisibilityChange);
    };
  }, []);

  // Check license when navigating back from license page
  useEffect(() => {
    // If we've just navigated from /license to another page, refresh license status
    if (previousPath.current === '/license' && location.pathname !== '/license') {
      checkLicense();
    }
    
    // Store current path for next comparison
    previousPath.current = location.pathname;
  }, [location.pathname]);

  const toggleTheme = () => {
    if (theme === 'light') {
      setTheme('dark');
    } else if (theme === 'dark') {
      setTheme('system');
    } else {
      setTheme('light');
    }
  };

  // Helper function to get license display info for the new per-camera model
  const getLicenseInfo = () => {
    if (!cameraLicenseStatus || !isLicenseLoaded) {
      return {
        label: 'Loading...',
        icon: <LockIcon fontSize="small" />,
        color: 'default',
        backgroundColor: '#6e6e6e',
        textColor: '#ffffff'
      };
    }
    
    const { camera_count, trial_limit, trial_cameras, is_trial_limit_exceeded } = cameraLicenseStatus;
    
    if (camera_count === 0) {
      return {
        label: 'No Cameras',
        icon: <VideocamIcon fontSize="small" />,
        color: 'default',
        backgroundColor: '#757575',
        textColor: '#ffffff'
      };
    }
    
    if (trial_cameras > 0 && !is_trial_limit_exceeded) {
      return {
        label: `Trial (${trial_cameras}/${trial_limit})`,
        icon: <StarIcon fontSize="small" />,
        color: 'warning',
        backgroundColor: '#ff9800',
        textColor: '#ffffff'
      };
    }
    
    if (is_trial_limit_exceeded) {
      return {
        label: 'Trial Exceeded',
        icon: <ErrorOutlineIcon fontSize="small" />,
        color: 'error',
        backgroundColor: '#f44336',
        textColor: '#ffffff'
      };
    }
    
    // Has licensed cameras
    const licensedCameras = camera_count - trial_cameras;
    if (licensedCameras > 0) {
      return {
        label: `Licensed (${licensedCameras})`,
        icon: <VerifiedIcon fontSize="small" />,
        color: 'success',
        backgroundColor: '#4caf50',
        textColor: '#ffffff'
      };
    }
    
    return {
      label: 'Active',
      icon: <VerifiedIcon fontSize="small" />,
      color: 'primary',
      backgroundColor: '#2196f3',
      textColor: '#ffffff'
    };
  };

  return (
    <AppBar position="sticky" elevation={0}>
      <Container maxWidth="xl">
        <Toolbar disableGutters>
          <VideocamIcon sx={{ display: { xs: 'none', md: 'flex' }, mr: 1 }} />
          <Typography
            variant="h6"
            noWrap
            component={RouterLink}
            to="/"
            sx={{
              mr: 2,
              display: { xs: 'none', md: 'flex' },
              fontWeight: 700,
              color: 'inherit',
              textDecoration: 'none',
            }}
          >
            {appConfig.appName}
          </Typography>

          {/* Mobile logo */}
          <VideocamIcon sx={{ display: { xs: 'flex', md: 'none' }, mr: 1 }} />
          <Typography
            variant="h6"
            noWrap
            component={RouterLink}
            to="/"
            sx={{
              mr: 2,
              display: { xs: 'flex', md: 'none' },
              flexGrow: 1,
              fontWeight: 700,
              color: 'inherit',
              textDecoration: 'none',
            }}
          >
            {appConfig.appName.split(' ')[0]}
          </Typography>

          <Box sx={{ flexGrow: 1, display: 'flex' }}>
            <Button
              component={RouterLink}
              to="/"
              sx={{ my: 2, color: 'inherit', display: 'block' }}
            >
              Cameras
            </Button>
          </Box>

          <Box sx={{ flexGrow: 0, display: 'flex', alignItems: 'center' }}>
            {/* Version indicator */}
            <Tooltip title="Application Version">
              <Chip 
                label={VERSION_DISPLAY} 
                size="small" 
                variant="outlined"
                sx={{ mr: 2, borderColor: 'rgba(255,255,255,0.3)' }}
              />
            </Tooltip>
            
            {/* Camera license status indicator */}
            <LicenseBadge
              tier={getLicenseInfo().label.toLowerCase()}
              isValid={isLicenseLoaded && !cameraLicenseStatus?.is_trial_limit_exceeded}
              tooltipText={
                checkingLicense 
                  ? "Checking license..." 
                  : cameraLicenseStatus
                    ? `${cameraLicenseStatus.camera_count} camera(s) configured. ${cameraLicenseStatus.trial_cameras} trial, ${cameraLicenseStatus.camera_count - cameraLicenseStatus.trial_cameras} licensed.`
                    : "Click to manage camera licensing."
              }
              onClick={() => window.location.pathname !== '/license' && (window.location.href = '/license')}
              style={{ marginRight: '16px' }}
            />
            
            <Tooltip title="Manage License">
              <Button
                component={RouterLink}
                to="/license"
                variant="outlined"
                color="inherit"
                startIcon={<VpnKeyIcon />}
                sx={{ mr: 2 }}
              >
                License
              </Button>
            </Tooltip>
            
            <Tooltip title={`Current theme: ${theme}. Click to cycle themes.`}>
              <IconButton onClick={toggleTheme} color="inherit">
                <ThemeToggleIcon />
              </IconButton>
            </Tooltip>
          </Box>
        </Toolbar>
      </Container>
    </AppBar>
  );
};

export default Navbar; 