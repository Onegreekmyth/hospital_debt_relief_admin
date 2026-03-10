import { useState, useCallback } from 'react';

import Box from '@mui/material/Box';
import Card from '@mui/material/Card';
import Stack from '@mui/material/Stack';
import Button from '@mui/material/Button';
import Typography from '@mui/material/Typography';
import Alert from '@mui/material/Alert';

import { DashboardContent } from 'src/layouts/dashboard';
import { Iconify } from 'src/components/iconify';

// ----------------------------------------------------------------------

const REQUIRED_WIDTH = 1920;
const REQUIRED_HEIGHT = 1080;
const REQUIRED_DIMENSIONS_TEXT = `${REQUIRED_WIDTH} × ${REQUIRED_HEIGHT} px`;
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

  const dimensionsValid =
    imageDimensions &&
    imageDimensions.width === REQUIRED_WIDTH &&
    imageDimensions.height === REQUIRED_HEIGHT;

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
        if (dims.width !== REQUIRED_WIDTH || dims.height !== REQUIRED_HEIGHT) {
          setMessage({
            type: 'error',
            text: `Image must be exactly ${REQUIRED_DIMENSIONS_TEXT}. Current size: ${dims.width} × ${dims.height} px.`,
          });
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
      setMessage({ type: 'info', text: 'Select an image with dimensions 1920 × 1080 px.' });
      return;
    }
    // API will be connected later
    setMessage({ type: 'info', text: 'Upload will be connected to the API later.' });
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
                  <Typography variant="caption" color={dimensionsValid ? 'success.main' : 'error.main'}>
                    {imageDimensions.width} × {imageDimensions.height} px
                    {dimensionsValid ? ' — Valid' : ' — Must be 1920 × 1080'}
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
                  disabled={!dimensionsValid || checkingDimensions}
                  startIcon={<Iconify icon="solar:upload-bold-duotone" />}
                >
                  Upload banner
                </Button>
                <Button variant="outlined" color="inherit" onClick={handleRemove}>
                  Remove
                </Button>
              </Stack>
            </Stack>
          )}
        </Card>

        <Alert severity="info" variant="soft">
          API integration will be added later. Use this page to select and preview the banner image;
          the upload button will be connected to the backend when ready.
        </Alert>
      </Stack>
    </DashboardContent>
  );
}
