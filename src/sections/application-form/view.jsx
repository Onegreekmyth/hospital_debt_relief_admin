import { useState, useEffect, useCallback, useRef } from 'react';

import Box from '@mui/material/Box';
import Card from '@mui/material/Card';
import Stack from '@mui/material/Stack';
import Button from '@mui/material/Button';
import Typography from '@mui/material/Typography';
import CircularProgress from '@mui/material/CircularProgress';
import Alert from '@mui/material/Alert';
import Chip from '@mui/material/Chip';
import TextField from '@mui/material/TextField';
import Dialog from '@mui/material/Dialog';
import DialogTitle from '@mui/material/DialogTitle';
import DialogContent from '@mui/material/DialogContent';
import DialogActions from '@mui/material/DialogActions';

import { useParams, useNavigate } from 'react-router-dom';

import { DashboardContent } from 'src/layouts/dashboard';
import { Iconify } from 'src/components/iconify';
import axios, { endpoints } from 'src/utils/axios';

import * as pdfjsLib from 'pdfjs-dist';
// eslint-disable-next-line import/no-unresolved
import pdfjsWorker from 'pdfjs-dist/build/pdf.worker.min.mjs?url';
import * as fabric from 'fabric';

pdfjsLib.GlobalWorkerOptions.workerSrc = pdfjsWorker;

const FONTS = ['Arial', 'Helvetica', 'Times New Roman', 'Courier New', 'Georgia', 'Verdana'];
const FONT_SIZES = [8, 10, 12, 14, 16, 18, 20, 24, 28, 32, 36, 42, 48];
const COLORS = [
  '#000000', '#333333', '#FF0000', '#0000FF', '#008000', '#FF8C00', '#800080', '#FFFFFF',
];

const STATUS_LABELS = {
  application_added: 'Application Added',
  application_submitted: 'Application Submitted',
  application_info_requested: 'Info Requested',
};

const STATUS_COLORS = {
  application_added: 'info',
  application_submitted: 'success',
  application_info_requested: 'warning',
};

export function ApplicationFormView() {
  const { userId, billId } = useParams();
  const navigate = useNavigate();

  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);
  const [formData, setFormData] = useState(null);
  const [saving, setSaving] = useState(false);
  const [lastSaved, setLastSaved] = useState(null);
  const [requestChangesOpen, setRequestChangesOpen] = useState(false);
  const [requestNote, setRequestNote] = useState('');
  const [requestingChanges, setRequestingChanges] = useState(false);

  // PDF editor state
  const canvasContainerRef = useRef(null);
  const fabricCanvasesRef = useRef([]);
  const pdfDocRef = useRef(null);
  const hasChangesRef = useRef(false);
  const [numPages, setNumPages] = useState(0);
  const [pdfLoading, setPdfLoading] = useState(true);
  const [activeTool, setActiveTool] = useState('select');
  const [fontFamily, setFontFamily] = useState('Arial');
  const [fontSize, setFontSize] = useState(16);
  const [fontColor, setFontColor] = useState('#000000');

  const fetchForm = useCallback(async () => {
    try {
      setLoading(true);
      const res = await axios.get(endpoints.users.getApplicationForm(userId, billId));
      if (res.data.success) {
        setFormData(res.data.data);
      } else {
        setError('Application form not found');
      }
    } catch (err) {
      setError(err?.message || 'Failed to load application form');
    } finally {
      setLoading(false);
    }
  }, [userId, billId]);

  useEffect(() => {
    fetchForm();
  }, [fetchForm]);

  // Load PDF via backend proxy to avoid S3 CORS issues
  useEffect(() => {
    if (!formData?.applicationForm?.pdfKey) return;
    setPdfLoading(true);

    const loadPdf = async () => {
      try {
        // Fetch PDF as blob through admin document preview proxy
        const blobRes = await axios.get(
          endpoints.documents.preview(formData.applicationForm.pdfKey),
          { responseType: 'blob', timeout: 60000 }
        );
        const blobUrl = URL.createObjectURL(blobRes.data);

        const pdf = await pdfjsLib.getDocument({
          url: blobUrl,
          cMapUrl: `https://cdnjs.cloudflare.com/ajax/libs/pdf.js/${pdfjsLib.version}/cmaps/`,
          cMapPacked: true,
        }).promise;
        pdfDocRef.current = pdf;
        setNumPages(pdf.numPages);
        setPdfLoading(false);
      } catch (err) {
        console.error('PDF load error:', err);
        setError('Failed to load PDF');
        setPdfLoading(false);
      }
    };
    loadPdf();
  }, [formData?.applicationForm?.pdfKey]);

  // Render PDF pages
  useEffect(() => {
    if (!pdfDocRef.current || numPages === 0 || !canvasContainerRef.current) return undefined;

    let cancelled = false;

    // Dispose previous canvases
    fabricCanvasesRef.current.forEach((c) => { try { c.dispose(); } catch (ex) { /* ok */ } });
    fabricCanvasesRef.current = [];

    const container = canvasContainerRef.current;
    container.innerHTML = '';

    const renderPages = async () => {
      const newCanvases = [];

      for (let i = 1; i <= numPages; i += 1) {
        if (cancelled) return;

        // eslint-disable-next-line no-await-in-loop
        const page = await pdfDocRef.current.getPage(i);
        if (cancelled) return;

        const viewport = page.getViewport({ scale: 1.5 });

        const wrapper = document.createElement('div');
        wrapper.style.cssText = `position: relative; margin-bottom: 16px; box-shadow: 0 2px 12px rgba(0,0,0,0.15); border-radius: 4px; overflow: hidden; background: white; width: ${viewport.width}px; height: ${viewport.height}px;`;

        const pdfCanvas = document.createElement('canvas');
        pdfCanvas.width = viewport.width;
        pdfCanvas.height = viewport.height;
        pdfCanvas.style.cssText = `display: block; width: ${viewport.width}px; height: ${viewport.height}px;`;

        // eslint-disable-next-line no-await-in-loop
        await page.render({ canvasContext: pdfCanvas.getContext('2d'), viewport }).promise;
        if (cancelled) return;

        const fabricCanvasEl = document.createElement('canvas');
        fabricCanvasEl.id = `admin-fabric-${i}`;

        const overlay = document.createElement('div');
        overlay.style.cssText = `position: absolute; top: 0; left: 0; width: ${viewport.width}px; height: ${viewport.height}px;`;
        overlay.appendChild(fabricCanvasEl);

        wrapper.appendChild(pdfCanvas);
        wrapper.appendChild(overlay);
        container.appendChild(wrapper);

        const fc = new fabric.Canvas(fabricCanvasEl, {
          width: viewport.width,
          height: viewport.height,
          selection: true,
        });

        fc.on('object:modified', () => { hasChangesRef.current = true; });
        fc.on('object:added', () => { hasChangesRef.current = true; });
        fc.on('object:removed', () => { hasChangesRef.current = true; });

        newCanvases.push(fc);
      }

      if (cancelled) {
        newCanvases.forEach((c) => { try { c.dispose(); } catch (ex) { /* ok */ } });
        return;
      }

      fabricCanvasesRef.current = newCanvases;

      // Load annotations (fabric v7 loadFromJSON returns a promise)
      if (formData?.applicationForm?.annotations) {
        try {
          const parsed = typeof formData.applicationForm.annotations === 'string'
            ? JSON.parse(formData.applicationForm.annotations)
            : formData.applicationForm.annotations;
          await Promise.all(Object.keys(parsed).map(async (idx) => {
            const canvas = fabricCanvasesRef.current[parseInt(idx, 10)];
            if (canvas && parsed[idx]) {
              await canvas.loadFromJSON(parsed[idx]);
              canvas.renderAll();
            }
          }));
        } catch (e) {
          console.error('Error loading annotations:', e);
        }
      }
    };

    renderPages();

    return () => {
      cancelled = true;
      fabricCanvasesRef.current.forEach((c) => { try { c.dispose(); } catch (ex) { /* disposed */ } });
      fabricCanvasesRef.current = [];
    };
  }, [numPages, formData?.applicationForm?.annotations]);

  // Tool effects
  useEffect(() => {
    fabricCanvasesRef.current.forEach((canvas) => {
      canvas.isDrawingMode = false;
      canvas.defaultCursor = 'default';
      canvas.hoverCursor = 'move';

      if (activeTool === 'draw') {
        canvas.isDrawingMode = true;
        canvas.freeDrawingBrush = new fabric.PencilBrush(canvas);
        canvas.freeDrawingBrush.color = fontColor;
        canvas.freeDrawingBrush.width = 2;
        canvas.selection = false;
      } else if (activeTool === 'text') {
        canvas.selection = true;
        canvas.defaultCursor = 'text';
        canvas.hoverCursor = 'pointer';
        canvas.forEachObject((obj) => { obj.selectable = true; obj.evented = true; });
      } else if (activeTool === 'eraser') {
        canvas.selection = false;
        canvas.defaultCursor = 'crosshair';
        canvas.hoverCursor = 'crosshair';
      } else {
        canvas.selection = true;
        canvas.forEachObject((obj) => { obj.selectable = true; obj.evented = true; });
      }
    });
  }, [activeTool, fontColor]);

  // Click handler for text and eraser
  useEffect(() => {
    const handlers = [];
    fabricCanvasesRef.current.forEach((canvas) => {
      const handler = (opt) => {
        if (activeTool === 'eraser' && opt.target) {
          canvas.remove(opt.target);
          canvas.renderAll();
          return;
        }

        // If clicked an existing object, let fabric handle it (select/edit)
        if (opt.target) return;

        if (activeTool === 'text') {
          const pointer = opt.scenePoint || canvas.getPointer(opt.e);
          const text = new fabric.IText('Type here', {
            left: pointer.x,
            top: pointer.y,
            fontFamily,
            fontSize,
            fill: fontColor,
            editable: true,
            padding: 5,
            borderColor: '#5225cd',
            cornerColor: '#5225cd',
            cornerSize: 8,
            transparentCorners: false,
          });
          canvas.add(text);
          canvas.setActiveObject(text);
          canvas.renderAll();
          // Enter editing after fabric finishes its mousedown processing
          setTimeout(() => {
            text.enterEditing();
            text.selectAll();
            canvas.renderAll();
          }, 100);
        }
      };
      canvas.on('mouse:down', handler);
      handlers.push({ canvas, handler });
    });
    return () => {
      handlers.forEach(({ canvas, handler }) => canvas.off('mouse:down', handler));
    };
  }, [activeTool, fontFamily, fontSize, fontColor]);

  const getAnnotationsJson = useCallback(() => {
    const annotations = {};
    fabricCanvasesRef.current.forEach((canvas, idx) => {
      const json = canvas.toJSON();
      if (json.objects?.length > 0) {
        annotations[idx] = json;
      }
    });
    return JSON.stringify(annotations);
  }, []);

  const handleSave = async () => {
    if (saving) return;
    setSaving(true);
    try {
      await axios.patch(
        endpoints.users.saveApplicationForm(userId, billId),
        { annotations: getAnnotationsJson() }
      );
      hasChangesRef.current = false;
      setLastSaved(new Date());
    } catch (err) {
      setError(err?.message || 'Failed to save');
    } finally {
      setSaving(false);
    }
  };

  const handleRequestChanges = async () => {
    setRequestingChanges(true);
    try {
      await axios.patch(
        endpoints.users.requestApplicationChanges(userId, billId),
        { note: requestNote }
      );
      setRequestChangesOpen(false);
      setRequestNote('');
      await fetchForm();
    } catch (err) {
      setError(err?.message || 'Failed to request changes');
    } finally {
      setRequestingChanges(false);
    }
  };

  if (loading) {
    return (
      <DashboardContent maxWidth="xl">
        <Box sx={{ display: 'flex', justifyContent: 'center', py: 10 }}>
          <CircularProgress />
        </Box>
      </DashboardContent>
    );
  }

  if (error && !formData) {
    return (
      <DashboardContent maxWidth="xl">
        <Alert severity="error">{error}</Alert>
        <Button onClick={() => navigate(-1)} sx={{ mt: 2 }}>Go back</Button>
      </DashboardContent>
    );
  }

  const status = formData?.status || '';

  return (
    <DashboardContent maxWidth="xl">
      <Stack spacing={3}>
        {/* Header */}
        <Stack direction="row" alignItems="center" justifyContent="space-between" flexWrap="wrap" gap={2}>
          <Stack direction="row" alignItems="center" spacing={2}>
            <Button
              startIcon={<Iconify icon="eva:arrow-back-fill" />}
              onClick={() => navigate(-1)}
              variant="text"
            >
              Back
            </Button>
            <Typography variant="h4">Application Form Editor</Typography>
            {formData?.patientName && (
              <Typography variant="body2" color="text.secondary">
                Patient: {formData.patientName}
              </Typography>
            )}
          </Stack>
          <Stack direction="row" spacing={1} alignItems="center">
            <Chip
              label={STATUS_LABELS[status] || status}
              color={STATUS_COLORS[status] || 'default'}
              size="small"
            />
            {status === 'application_submitted' && (
              <Button
                variant="contained"
                color="warning"
                size="small"
                startIcon={<Iconify icon="solar:pen-new-round-bold" />}
                onClick={() => setRequestChangesOpen(true)}
              >
                Request Changes
              </Button>
            )}
          </Stack>
        </Stack>

        {error && <Alert severity="error" onClose={() => setError(null)}>{error}</Alert>}

        {/* Admin Note */}
        {formData?.applicationForm?.adminNote && (
          <Alert severity="warning" icon={<Iconify icon="solar:pen-new-round-bold" />}>
            <strong>Your note to user:</strong> {formData.applicationForm.adminNote}
          </Alert>
        )}

        {/* Toolbar */}
        <Card sx={{ p: 2 }}>
          <Stack direction="row" spacing={1} alignItems="center" flexWrap="wrap" gap={1}>
            {['select', 'text', 'draw', 'eraser'].map((tool) => (
              <Button
                key={tool}
                size="small"
                variant={activeTool === tool ? 'contained' : 'outlined'}
                onClick={() => setActiveTool(tool)}
                sx={{ textTransform: 'capitalize' }}
              >
                {tool}
              </Button>
            ))}

            <Box sx={{ width: 1, height: '1px', bgcolor: 'divider', mx: 1 }} component="span" />

            <select
              value={fontFamily}
              onChange={(e) => setFontFamily(e.target.value)}
              style={{ padding: '4px 8px', borderRadius: 4, border: '1px solid #ccc', fontSize: 13 }}
            >
              {FONTS.map((f) => <option key={f} value={f}>{f}</option>)}
            </select>

            <select
              value={fontSize}
              onChange={(e) => setFontSize(parseInt(e.target.value, 10))}
              style={{ padding: '4px 8px', borderRadius: 4, border: '1px solid #ccc', fontSize: 13, width: 64 }}
            >
              {FONT_SIZES.map((s) => <option key={s} value={s}>{s}px</option>)}
            </select>

            <Stack direction="row" spacing={0.5}>
              {COLORS.map((c) => (
                <Box
                  key={c}
                  onClick={() => setFontColor(c)}
                  sx={{
                    width: 20,
                    height: 20,
                    borderRadius: '50%',
                    bgcolor: c,
                    border: fontColor === c ? '2px solid #5225cd' : '1px solid #ccc',
                    cursor: 'pointer',
                  }}
                />
              ))}
            </Stack>

            <Box sx={{ flex: 1 }} />

            {saving && <CircularProgress size={18} />}
            {!saving && lastSaved && (
              <Typography variant="caption" color="success.main">Saved</Typography>
            )}
            <Button
              size="small"
              variant="contained"
              onClick={handleSave}
              disabled={saving}
              startIcon={<Iconify icon="solar:diskette-bold" />}
            >
              Save
            </Button>
          </Stack>
        </Card>

        {/* PDF Canvas */}
        <Card sx={{ p: 2, minHeight: 600 }}>
          {pdfLoading ? (
            <Box sx={{ display: 'flex', justifyContent: 'center', py: 10 }}>
              <CircularProgress />
            </Box>
          ) : (
            <Box
              ref={canvasContainerRef}
              sx={{ overflow: 'auto', display: 'flex', flexDirection: 'column', alignItems: 'center', bgcolor: '#e5e5e5', p: 2, borderRadius: 1 }}
            />
          )}
        </Card>
      </Stack>

      {/* Request Changes Dialog */}
      <Dialog open={requestChangesOpen} onClose={() => setRequestChangesOpen(false)} maxWidth="sm" fullWidth>
        <DialogTitle>Request Changes</DialogTitle>
        <DialogContent>
          <Typography variant="body2" color="text.secondary" sx={{ mb: 2 }}>
            The user will be notified via email and can update their application.
          </Typography>
          <TextField
            label="Note to user (optional)"
            multiline
            rows={4}
            fullWidth
            value={requestNote}
            onChange={(e) => setRequestNote(e.target.value)}
            placeholder="Please update the income section..."
          />
        </DialogContent>
        <DialogActions sx={{ px: 3, pb: 2 }}>
          <Button onClick={() => setRequestChangesOpen(false)}>Cancel</Button>
          <Button
            variant="contained"
            color="warning"
            disabled={requestingChanges}
            onClick={handleRequestChanges}
            startIcon={requestingChanges ? <CircularProgress size={16} color="inherit" /> : null}
          >
            {requestingChanges ? 'Sending...' : 'Send & Notify User'}
          </Button>
        </DialogActions>
      </Dialog>
    </DashboardContent>
  );
}
