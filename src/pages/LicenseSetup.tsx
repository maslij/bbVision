import { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import {
  Container,
  Typography,
  Box,
  Button,
  Paper,
  Alert,
  CircularProgress,
  Divider,
  Card,
  CardContent,
  Chip,
  Dialog,
  DialogTitle,
  DialogContent,
  DialogActions,
  Grid,
  LinearProgress
} from '@mui/material';
import {
  Security as SecurityIcon,
  Info as InfoIcon,
  Upgrade as UpgradeIcon,
  Videocam as VideocamIcon,
  CheckCircle as CheckCircleIcon,
  AttachMoney as AttachMoneyIcon,
  TrendingUp as TrendingUpIcon,
  Timer as TimerIcon
} from '@mui/icons-material';

import apiService from '../services/api';
import { LicenseStatus, SubscriptionInfo, GrowthPackInfo } from '../services/api';

// Define a custom event for license changes (for backwards compatibility)
export const LICENSE_CHANGED_EVENT = 'license_status_changed';

// Create a helper function to dispatch the event
export const notifyLicenseChanged = () => {
  const event = new CustomEvent(LICENSE_CHANGED_EVENT);
  document.dispatchEvent(event);
};

// Growth Pack interface
interface GrowthPack {
  id: string;
  name: string;
  description: string;
  price: string;
  unit: string;
  features: string[];
  category: 'analytics' | 'intelligence' | 'data' | 'integration';
}

// Growth packs definition based on the pricing construct
const GROWTH_PACKS: Record<string, GrowthPack> = {
  advanced_analytics: {
    id: 'advanced_analytics',
    name: 'Advanced Analytics Pack',
    description: 'Enhanced analytics and active transport detection',
    price: '$20',
    unit: 'per camera/month',
    category: 'analytics',
    features: [
      'Active Transport Detection',
      'Advanced occupancy tracking',
      'Heat mapping',
      'Queue analysis',
      'Dwell time analytics'
    ]
  },
  intelligence: {
    id: 'intelligence',
    name: 'Intelligence Pack',
    description: 'AI-powered insights and LLM integration',
    price: '$400',
    unit: 'per tenant/month',
    category: 'intelligence',
    features: [
      '3 LLM seats included',
      'AI-powered insights',
      'Natural language queries',
      'Smart alerts',
      'Predictive analytics'
    ]
  },
  data: {
    id: 'data',
    name: 'Data Pack',
    description: 'Extended storage and data retention',
    price: '$100',
    unit: 'per tenant/month',
    category: 'data',
    features: [
      '500 GB storage',
      'Extended retention (90 days)',
      'Cloud export',
      'Data backups',
      'CSV/JSON exports'
    ]
  },
  integration: {
    id: 'integration',
    name: 'Integration Pack',
    description: 'API access and third-party integrations',
    price: '$200',
    unit: 'per tenant/month',
    category: 'integration',
    features: [
      '50,000 API calls/month',
      'Webhook support',
      'SMS alerts (100/month)',
      'Third-party integrations',
      'Custom exports'
    ]
  }
};

// Pricing plans
const PRICING_PLANS = {
  trial: {
    name: 'Free Trial',
    description: 'Perfect for testing and evaluation',
    price: 'Free',
    duration: '90 days',
    cameras: '2 cameras maximum',
    features: [
      '2 cameras maximum',
      '90-day trial period',
      'All base features included',
      'Object detection & tracking',
      'Basic analytics',
      'File recording'
    ]
  },
  base: {
    name: 'Base License',
    description: 'Core computer vision features',
    price: '$60',
    unit: 'per camera/month',
    cameras: 'Unlimited cameras',
    features: [
      'Unlimited cameras',
      '3 CV models (person, vehicle, bicycle)',
      'Object detection & tracking',
      'Line crossing & polygon zones',
      '7-day storage (30GB)',
      'File + cloud outputs',
      'Email support'
    ]
  }
};

const LicenseSetup = () => {
  const navigate = useNavigate();
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [licenseStatus, setLicenseStatus] = useState<LicenseStatus | null>(null);
  const [subscription, setSubscription] = useState<SubscriptionInfo | null>(null);
  const [enabledGrowthPacks, setEnabledGrowthPacks] = useState<string[]>([]);
  const [showPricingDialog, setShowPricingDialog] = useState(false);
  const [showGrowthPacksDialog, setShowGrowthPacksDialog] = useState(false);

  useEffect(() => {
    loadLicenseData();
  }, []);

  const loadLicenseData = async () => {
    setLoading(true);
    try {
      const [license, sub, growthPacks] = await Promise.all([
        apiService.billing.getLicenseStatus('tenant-123'),
        apiService.billing.getSubscription('tenant-123'),
        apiService.billing.getEnabledGrowthPacks('tenant-123')
      ]);

      setLicenseStatus(license);
      setSubscription(sub);
      setEnabledGrowthPacks(growthPacks || []);
      
      // Notify other components that license data changed
      notifyLicenseChanged();
    } catch (err) {
      console.error('Error loading license data:', err);
      setError('Could not load licensing information. Please try again.');
    } finally {
      setLoading(false);
    }
  };

  const handleUpgrade = () => {
    setShowPricingDialog(true);
  };

  const handleManageGrowthPacks = () => {
    setShowGrowthPacksDialog(true);
  };

  if (loading) {
    return (
      <Container maxWidth="lg" sx={{ mt: 8, mb: 4 }}>
        <Box display="flex" justifyContent="center" alignItems="center" flexDirection="column" my={5}>
          <CircularProgress sx={{ mb: 2 }} />
          <Typography>Loading billing information...</Typography>
        </Box>
      </Container>
    );
  }

  const isTrialMode = licenseStatus?.license_mode === 'trial';
  const daysRemaining = licenseStatus?.days_remaining || 0;
  const activeCameras = licenseStatus?.active_cameras || 0;
  const maxCameras = isTrialMode ? licenseStatus?.trial_max_cameras : licenseStatus?.cameras_allowed;

  return (
    <Container maxWidth="lg" sx={{ mt: 4, mb: 4 }}>
      {/* Header */}
      <Box display="flex" justifyContent="space-between" alignItems="center" mb={4}>
        <Box>
          <Typography variant="h4" component="h1" gutterBottom>
            Billing & Licensing
          </Typography>
          <Typography variant="body1" color="text.secondary">
            Manage your subscription, licenses, and growth packs
          </Typography>
        </Box>
        <Button
          variant="outlined"
          startIcon={<InfoIcon />}
          onClick={() => setShowPricingDialog(true)}
        >
          View Pricing
        </Button>
      </Box>

      {error && (
        <Alert severity="error" sx={{ mb: 3 }} onClose={() => setError(null)}>
          {error}
        </Alert>
      )}

      <Grid container spacing={3}>
        {/* License Status Card */}
        <Grid item xs={12} md={6}>
          <Card sx={{ height: '100%' }}>
            <CardContent>
              <Box display="flex" alignItems="center" gap={2} mb={2}>
                <SecurityIcon color="primary" fontSize="large" />
                <Typography variant="h6">License Status</Typography>
              </Box>
              <Divider sx={{ mb: 2 }} />

              <Box mb={2}>
                <Typography variant="body2" color="text.secondary" gutterBottom>
                  Current Plan
                </Typography>
                <Chip
                  label={isTrialMode ? 'Free Trial' : 'Base License'}
                  color={isTrialMode ? 'warning' : 'success'}
                  icon={isTrialMode ? <TimerIcon /> : <CheckCircleIcon />}
                />
              </Box>

              {isTrialMode && (
                <Box mb={2}>
                  <Typography variant="body2" color="text.secondary" gutterBottom>
                    Trial Period
                  </Typography>
                  <Typography variant="h6" color={daysRemaining < 10 ? 'warning.main' : 'text.primary'}>
                    {daysRemaining} days remaining
                  </Typography>
                  <LinearProgress
                    variant="determinate"
                    value={(daysRemaining / 90) * 100}
                    sx={{ mt: 1 }}
                    color={daysRemaining < 10 ? 'warning' : 'primary'}
                  />
                </Box>
              )}

              <Box mb={2}>
                <Typography variant="body2" color="text.secondary" gutterBottom>
                  Active Cameras
                </Typography>
                <Typography variant="h6">
                  {activeCameras} / {maxCameras || '∞'}
                </Typography>
                {maxCameras && (
                  <LinearProgress
                    variant="determinate"
                    value={(activeCameras / maxCameras) * 100}
                    sx={{ mt: 1 }}
                  />
                )}
              </Box>

              {licenseStatus?.valid_until && (
                <Box>
                  <Typography variant="body2" color="text.secondary" gutterBottom>
                    Valid Until
                  </Typography>
                  <Typography variant="body1">
                    {new Date(licenseStatus.valid_until).toLocaleDateString()}
                  </Typography>
                </Box>
              )}

              {isTrialMode && daysRemaining < 30 && (
                <Alert severity="warning" sx={{ mt: 2 }}>
                  Your trial is expiring soon. Upgrade to continue using all features.
                </Alert>
              )}

              <Button
                fullWidth
                variant="contained"
                startIcon={<UpgradeIcon />}
                onClick={handleUpgrade}
                sx={{ mt: 2 }}
                disabled={!isTrialMode}
              >
                {isTrialMode ? 'Upgrade to Base License' : 'Manage Subscription'}
              </Button>
            </CardContent>
          </Card>
        </Grid>

        {/* Growth Packs Card */}
        <Grid item xs={12} md={6}>
          <Card sx={{ height: '100%' }}>
            <CardContent>
              <Box display="flex" alignItems="center" gap={2} mb={2}>
                <TrendingUpIcon color="primary" fontSize="large" />
                <Typography variant="h6">Growth Packs</Typography>
              </Box>
              <Divider sx={{ mb: 2 }} />

              <Typography variant="body2" color="text.secondary" mb={2}>
                Enhance your system with modular growth packs
              </Typography>

              {enabledGrowthPacks.length > 0 ? (
                <Box mb={2}>
                  <Typography variant="subtitle2" gutterBottom>
                    Active Packs
                  </Typography>
                  <Box display="flex" flexWrap="wrap" gap={1} mb={2}>
                    {enabledGrowthPacks.map((packId) => {
                      const pack = GROWTH_PACKS[packId];
                      return pack ? (
                        <Chip
                          key={packId}
                          label={pack.name}
                          color="success"
                          size="small"
                          icon={<CheckCircleIcon />}
                        />
                      ) : null;
                    })}
                  </Box>
                </Box>
              ) : (
                <Alert severity="info" sx={{ mb: 2 }}>
                  No growth packs currently active
                </Alert>
              )}

              <Button
                fullWidth
                variant="outlined"
                startIcon={<AttachMoneyIcon />}
                onClick={handleManageGrowthPacks}
              >
                Browse Growth Packs
              </Button>

              <Box mt={2}>
                <Typography variant="caption" color="text.secondary">
                  Available packs: Advanced Analytics, Intelligence, Data, Integration
                </Typography>
              </Box>
            </CardContent>
          </Card>
        </Grid>

        {/* Camera Licenses Grid */}
        <Grid item xs={12}>
          <Card>
            <CardContent>
              <Box display="flex" alignItems="center" gap={2} mb={2}>
                <VideocamIcon color="primary" fontSize="large" />
                <Typography variant="h6">Camera Licenses</Typography>
              </Box>
              <Divider sx={{ mb: 2 }} />

              {licenseStatus?.cameras && licenseStatus.cameras.length > 0 ? (
                <Box>
                  {licenseStatus.cameras.map((camera) => (
                    <Box
                      key={camera.camera_id}
                      display="flex"
                      justifyContent="space-between"
                      alignItems="center"
                      p={2}
                      mb={1}
                      sx={{ bgcolor: 'background.default', borderRadius: 1 }}
                    >
                      <Box>
                        <Typography variant="body1" fontWeight="medium">
                          {camera.camera_id}
                        </Typography>
                        <Typography variant="caption" color="text.secondary">
                          Licensed since: {new Date(camera.start_date).toLocaleDateString()}
                        </Typography>
                      </Box>
                      <Box display="flex" gap={1}>
                        <Chip
                          label={camera.mode}
                          size="small"
                          color={camera.mode === 'trial' ? 'warning' : 'success'}
                        />
                        {camera.enabled_growth_packs && camera.enabled_growth_packs.length > 0 && (
                          <Chip
                            label={`${camera.enabled_growth_packs.length} packs`}
                            size="small"
                            variant="outlined"
                          />
                        )}
                      </Box>
                    </Box>
                  ))}
                </Box>
              ) : (
                <Alert severity="info">
                  No cameras configured yet. Add a camera to start using the system.
                </Alert>
              )}
            </CardContent>
          </Card>
        </Grid>
      </Grid>

      {/* Pricing Dialog */}
      <Dialog
        open={showPricingDialog}
        onClose={() => setShowPricingDialog(false)}
        maxWidth="md"
        fullWidth
      >
        <DialogTitle>Pricing Plans</DialogTitle>
        <DialogContent>
          <Grid container spacing={3}>
            {Object.entries(PRICING_PLANS).map(([key, plan]) => (
              <Grid item xs={12} sm={6} key={key}>
                <Card variant="outlined">
                  <CardContent>
                    <Typography variant="h6" gutterBottom>
                      {plan.name}
                    </Typography>
                    <Typography variant="h4" color="primary" gutterBottom>
                      {plan.price}
                      {plan.unit && (
                        <Typography component="span" variant="body2" color="text.secondary">
                          {' '}
                          {plan.unit}
                        </Typography>
                      )}
                    </Typography>
                    <Typography variant="body2" color="text.secondary" gutterBottom>
                      {plan.description}
                    </Typography>
                    <Divider sx={{ my: 2 }} />
                    <Box>
                      {plan.features.map((feature, idx) => (
                        <Box key={idx} display="flex" alignItems="center" gap={1} mb={1}>
                          <CheckCircleIcon fontSize="small" color="success" />
                          <Typography variant="body2">{feature}</Typography>
                        </Box>
                      ))}
                    </Box>
                  </CardContent>
                </Card>
              </Grid>
            ))}
          </Grid>
        </DialogContent>
        <DialogActions>
          <Button onClick={() => setShowPricingDialog(false)}>Close</Button>
          <Button variant="contained" onClick={() => {
            setShowPricingDialog(false);
            setError('Contact your administrator to upgrade your license.');
          }}>
            Contact Sales
          </Button>
        </DialogActions>
      </Dialog>

      {/* Growth Packs Dialog */}
      <Dialog
        open={showGrowthPacksDialog}
        onClose={() => setShowGrowthPacksDialog(false)}
        maxWidth="lg"
        fullWidth
      >
        <DialogTitle>Growth Packs</DialogTitle>
        <DialogContent>
          <Typography variant="body2" color="text.secondary" paragraph>
            Enhance your system with modular growth packs. Each pack adds specific features and capabilities.
          </Typography>
          <Grid container spacing={3}>
            {Object.entries(GROWTH_PACKS).map(([key, pack]) => (
              <Grid item xs={12} sm={6} key={key}>
                <Card
                  variant="outlined"
                  sx={{
                    borderColor: enabledGrowthPacks.includes(key) ? 'success.main' : 'divider',
                    borderWidth: enabledGrowthPacks.includes(key) ? 2 : 1
                  }}
                >
                  <CardContent>
                    <Box display="flex" justifyContent="space-between" alignItems="start" mb={1}>
                      <Typography variant="h6">{pack.name}</Typography>
                      {enabledGrowthPacks.includes(key) && (
                        <Chip label="Active" color="success" size="small" />
                      )}
                    </Box>
                    <Typography variant="h5" color="primary" gutterBottom>
                      {pack.price}
                      <Typography component="span" variant="body2" color="text.secondary">
                        {' '}
                        {pack.unit}
                      </Typography>
                    </Typography>
                    <Typography variant="body2" color="text.secondary" paragraph>
                      {pack.description}
                    </Typography>
                    <Divider sx={{ my: 1 }} />
                    <Box mt={2}>
                      {pack.features.map((feature, idx) => (
                        <Box key={idx} display="flex" alignItems="center" gap={1} mb={0.5}>
                          <CheckCircleIcon fontSize="small" color="action" />
                          <Typography variant="body2">{feature}</Typography>
                        </Box>
                      ))}
                    </Box>
                  </CardContent>
                </Card>
              </Grid>
            ))}
          </Grid>
        </DialogContent>
        <DialogActions>
          <Button onClick={() => setShowGrowthPacksDialog(false)}>Close</Button>
          <Button variant="contained" onClick={() => {
            setShowGrowthPacksDialog(false);
            setError('Contact your administrator to add growth packs to your subscription.');
          }}>
            Request Pack
          </Button>
        </DialogActions>
      </Dialog>
    </Container>
  );
};

export default LicenseSetup;
