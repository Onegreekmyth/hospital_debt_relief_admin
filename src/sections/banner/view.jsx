import { useState, useCallback, useEffect } from 'react';

import Box from '@mui/material/Box';
import Card from '@mui/material/Card';
import Stack from '@mui/material/Stack';
import Button from '@mui/material/Button';
import Typography from '@mui/material/Typography';
import Alert from '@mui/material/Alert';

import { DashboardContent } from 'src/layouts/dashboard';
import { Iconify } from 'src/components/iconify';
import axios, { endpoints } from 'src/utils/axios';

// ----------------------------------------------------------------------

const MIN_WIDTH = 1280;
const MIN_HEIGHT = 720;
const REQUIRED_DIMENSIONS_TEXT = `16:9 aspect ratio (at least ${MIN_WIDTH} × ${MIN_HEIGHT} px)`;
const ACCEPT_IMAGES = 'image/jpeg,image/png,image/webp,image/gif';

function getImageDimensions(src) {
  return new Promise((resolve, reject) => {
    const img = new Image();
    img.onload = () => resolve({ width: img.naturalWidth, height: img.naturalHeight });
    img.onerror = reject;
    img.src = src;
  });
}

export function BannerView() {
  const [file, setFile] = useState(null);
  const [previewUrl, setPreviewUrl] = useState(null);
  const [imageDimensions, setImageDimensions] = useState(null);
  const [isDragging, setIsDragging] = useState(false);
  const [message, setMessage] = useState(null);
  const [checkingDimensions, setCheckingDimensions] = useState(false);
  const [saving, setSaving] = useState(false);

  // Load current banner for preview
  useEffect(() => {
    let active = true;
    const fetchCurrent = async () => {
      try {
        const res = await axios.get(endpoints.banner.current);
        if (!active) return;
        if (res.data?.success && res.data?.data?.imageUrl) {
          setPreviewUrl(res.data.data.imageUrl);
          if (res.data.data.width && res.data.data.height) {
            setImageDimensions({
              width: res.data.data.width,
              height: res.data.data.height,
            });
          }
        }
      } catch (err) {
        // eslint-disable-next-line no-console
        console.error('Failed to load current banner:', err);
      }
    };
    fetchCurrent();
    return () => {
      active = false;
    };
  }, []);

  const dimensionsValid =
    imageDimensions &&
    imageDimensions.width >= MIN_WIDTH &&
    imageDimensions.height >= MIN_HEIGHT;

  const clearPreview = useCallback(() => {
    if (previewUrl) {
      URL.revokeObjectURL(previewUrl);
      setPreviewUrl(null);
    }
    setImageDimensions(null);
  }, [previewUrl]);

  const handleFile = useCallback(
    async (selectedFile) => {
      if (!selectedFile || !selectedFile.type.startsWith('image/')) {
        setMessage({ type: 'warning', text: 'Please select an image file (JPEG, PNG, WebP, or GIF).' });
        return;
      }
      clearPreview();
      const url = URL.createObjectURL(selectedFile);
      setFile(selectedFile);
      setPreviewUrl(url);
      setMessage(null);
      setCheckingDimensions(true);
      try {
        const dims = await getImageDimensions(url);
        setImageDimensions(dims);
        if (dims.width < MIN_WIDTH || dims.height < MIN_HEIGHT) {
          setMessage({
            type: 'warning',
            text: `For best results, use an image at least ${MIN_WIDTH} × ${MIN_HEIGHT} px. Current size: ${dims.width} × ${dims.height} px.`,
          });
        } else {
          setMessage(null);
        }
      } catch {
        setMessage({ type: 'error', text: 'Could not read image dimensions.' });
      } finally {
        setCheckingDimensions(false);
      }
    },
    [clearPreview]
  );

  const handleInputChange = (e) => {
    const selectedFile = e.target.files?.[0];
    if (selectedFile) handleFile(selectedFile);
    e.target.value = '';
  };

  const handleDrop = (e) => {
    e.preventDefault();
    setIsDragging(false);
    const selectedFile = e.dataTransfer?.files?.[0];
    if (selectedFile) handleFile(selectedFile);
  };

  const handleDragOver = (e) => {
    e.preventDefault();
    setIsDragging(true);
  };

  const handleDragLeave = () => {
    setIsDragging(false);
  };

  const handleSave = () => {
    if (!file || !dimensionsValid) {
      setMessage({
        type: 'info',
        text: 'Select an image with a 16:9 aspect ratio and at least 1280 × 720 px.',
      });
      return;
    }

    const formData = new FormData();
    formData.append('image', file);
    if (imageDimensions?.width) formData.append('width', String(imageDimensions.width));
    if (imageDimensions?.height) formData.append('height', String(imageDimensions.height));

    setSaving(true);
    axios
      .post(endpoints.banner.current, formData, {
        headers: { 'Content-Type': 'multipart/form-data' },
      })
      .then((res) => {
        if (res.data?.success) {
          setMessage({ type: 'success', text: 'Banner updated successfully.' });
          if (res.data.data?.imageUrl) {
            setPreviewUrl(res.data.data.imageUrl);
          }
        } else {
          setMessage({
            type: 'error',
            text: res.data?.message || 'Failed to upload banner. Please try again.',
          });
        }
      })
      .catch((err) => {
        // eslint-disable-next-line no-console
        console.error('Upload banner error:', err);
        const text =
          err?.error ||
          err?.message ||
          err?.response?.data?.message ||
          'Failed to upload banner. Please try again.';
        setMessage({ type: 'error', text });
      })
      .finally(() => {
        setSaving(false);
      });
  };

  const handleRemove = () => {
    clearPreview();
    setFile(null);
    setMessage(null);
  };

  return (
    <DashboardContent maxWidth="md">
      <Stack spacing={3}>
        <Box>
          <Typography variant="h4">Home page banner</Typography>
          <Typography variant="body2" color="text.secondary" sx={{ mt: 0.5 }}>
            Upload a banner image for the Hospital Debt Relief website. This image will be shown on the
            web home page.
          </Typography>
        </Box>

        {message && (
          <Alert
            severity={message.type}
            onClose={() => setMessage(null)}
          >
            {message.text}
          </Alert>
        )}

        <Card sx={{ p: 3 }}>
          <Typography variant="subtitle2" color="text.secondary" sx={{ mb: 2 }}>
            Required size: {REQUIRED_DIMENSIONS_TEXT} (banner is displayed at this size on the web app)
          </Typography>

          <Box
            onDrop={handleDrop}
            onDragOver={handleDragOver}
            onDragLeave={handleDragLeave}
            sx={{
              border: '2px dashed',
              borderColor: isDragging ? 'primary.main' : 'divider',
              borderRadius: 2,
              bgcolor: isDragging ? 'action.hover' : 'background.neutral',
              py: 6,
              px: 2,
              textAlign: 'center',
              cursor: 'pointer',
              transition: (theme) =>
                theme.transitions.create(['border-color', 'background-color'], {
                  duration: theme.transitions.duration.short,
                }),
            }}
            component="label"
          >
            <input
              type="file"
              accept={ACCEPT_IMAGES}
              onChange={handleInputChange}
              hidden
            />
            <Stack alignItems="center" spacing={1}>
              <Iconify
                icon="solar:gallery-add-bold-duotone"
                width={48}
                sx={{ color: 'text.disabled' }}
              />
              <Typography variant="body2" color="text.secondary">
                Drag and drop an image here, or click to browse
              </Typography>
              <Typography variant="caption" color="text.disabled">
                JPEG, PNG, WebP, GIF
              </Typography>
            </Stack>
          </Box>

          {previewUrl && (
            <Stack spacing={2} sx={{ mt: 3 }}>
              <Stack direction="row" alignItems="center" justifyContent="space-between" flexWrap="wrap" gap={1}>
                <Typography variant="subtitle2">Preview</Typography>
                {imageDimensions && (
                  <Typography variant="caption" color={dimensionsValid ? 'success.main' : 'warning.main'}>
                    {imageDimensions.width} × {imageDimensions.height} px
                    {dimensionsValid
                      ? ' — Good for banner'
                      : ' — Consider a 16:9 image for best fit'}
                  </Typography>
                )}
                {checkingDimensions && (
                  <Typography variant="caption" color="text.secondary">
                    Checking dimensions…
                  </Typography>
                )}
              </Stack>
              <Box
                sx={{
                  borderRadius: 2,
                  overflow: 'hidden',
                  border: (theme) =>
                    `2px solid ${
                      checkingDimensions || !imageDimensions
                        ? theme.vars.palette.divider
                        : dimensionsValid
                          ? theme.vars.palette.success.main
                          : theme.vars.palette.error.main
                    }`,
                  bgcolor: 'background.neutral',
                }}
              >
                <Box
                  component="img"
                  src={previewUrl}
                  alt="Banner preview"
                  sx={{
                    width: 1,
                    display: 'block',
                    maxHeight: 320,
                    objectFit: 'contain',
                  }}
                />
              </Box>
              <Stack direction="row" spacing={1}>
                <Button
                  variant="contained"
                  onClick={handleSave}
                  disabled={!dimensionsValid || checkingDimensions || saving}
                  startIcon={<Iconify icon="solar:upload-bold-duotone" />}
                >
                  Upload banner
                </Button>
                <Button variant="outlined" color="inherit" onClick={handleRemove} disabled={saving}>
                  Remove
                </Button>
              </Stack>
            </Stack>
          )}
        </Card>

        <Alert severity="info" variant="soft">
          Banner images work best at a 16:9 ratio (for example 1920 × 1080 px). Larger 16:9 images will
          be scaled to fill the hero background.
        </Alert>
      </Stack>
    </DashboardContent>
  );
}
