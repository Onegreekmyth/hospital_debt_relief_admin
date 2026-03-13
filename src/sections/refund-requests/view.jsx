import { useState, useEffect, useCallback, useMemo, useRef } from 'react';

import Box from '@mui/material/Box';
import Card from '@mui/material/Card';
import Stack from '@mui/material/Stack';
import Button from '@mui/material/Button';
import Table from '@mui/material/Table';
import TableHead from '@mui/material/TableHead';
import TableRow from '@mui/material/TableRow';
import TableBody from '@mui/material/TableBody';
import TableCell from '@mui/material/TableCell';
import TableContainer from '@mui/material/TableContainer';
import TextField from '@mui/material/TextField';
import Typography from '@mui/material/Typography';
import CircularProgress from '@mui/material/CircularProgress';
import Alert from '@mui/material/Alert';
import Dialog from '@mui/material/Dialog';
import DialogTitle from '@mui/material/DialogTitle';
import DialogContent from '@mui/material/DialogContent';
import DialogActions from '@mui/material/DialogActions';
import FormControl from '@mui/material/FormControl';
import InputLabel from '@mui/material/InputLabel';
import Select from '@mui/material/Select';
import MenuItem from '@mui/material/MenuItem';
import Tabs from '@mui/material/Tabs';
import Tab from '@mui/material/Tab';

import { DashboardContent } from 'src/layouts/dashboard';
import { Iconify } from 'src/components/iconify';
import axios, { endpoints } from 'src/utils/axios';

// Document type labels (match Bill Approval page)
const DOCUMENT_TYPE_LABELS = {
  hospital_bill: 'Hospital Bill',
  drivers_license: 'Drivers License',
  utility_bill: 'Utility Bill',
  w2: 'W-2',
  prior_year_tax_return: "Prior Year's Tax Return",
  three_most_recent_paycheck_stubs: 'Three Most Recent Paycheck Stubs',
  proof_of_child_support_income: 'Proof of Child Support Income',
  retirement_check_stubs: 'Retirement Check Stubs',
  social_security_letters_or_deposit_slips: 'Social Security Letters or Deposit Slips',
  unemployment_check_stubs: 'Unemployment Check Stubs',
  other_governmental_program_check_stubs: 'Other Governmental Program Check Stubs',
  letter_from_employer: 'Letter from Employer',
};

const getDocumentTypeLabel = (value) =>
  (value && DOCUMENT_TYPE_LABELS[value]) || value || '—';

// ----------------------------------------------------------------------

function getDisplayName(user) {
  if (!user) return '—';
  const full = [user.firstName, user.lastName].filter(Boolean).join(' ');
  return full || user.name || user.email || '—';
}

function formatDate(dateString) {
  if (!dateString) return '—';
  return new Date(dateString).toLocaleDateString('en-US', {
    year: 'numeric',
    month: 'short',
    day: 'numeric',
    hour: '2-digit',
    minute: '2-digit',
  });
}

// ----------------------------------------------------------------------

function matchesSearch(row, query) {
  if (!query || !query.trim()) return true;
  const q = query.trim().toLowerCase();
  const userStr = getDisplayName(row.user)?.toLowerCase() || '';
  const email = (row.user?.email || '').toLowerCase();
  const patient = (row.patientName || '').toLowerCase();
  return userStr.includes(q) || email.includes(q) || patient.includes(q);
}

export function RefundRequestsView() {
  const [list, setList] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);
  const [searchQuery, setSearchQuery] = useState('');
  const [processingId, setProcessingId] = useState(null);
  const [processingAction, setProcessingAction] = useState(null);
  const [confirmOpen, setConfirmOpen] = useState(false);
  const [confirmPayload, setConfirmPayload] = useState(null);
  const [documentsBill, setDocumentsBill] = useState(null);
  const [docViewTab, setDocViewTab] = useState(0);
  const [sortBy, setSortBy] = useState('dateDesc'); // dateDesc | dateAsc
  const [previewBlobUrl, setPreviewBlobUrl] = useState(null);
  const [previewLoading, setPreviewLoading] = useState(false);
  const previewBlobUrlRef = useRef(null);

  const filteredList = useMemo(() => {
    let result = list.filter((row) => matchesSearch(row, searchQuery));
    result = [...result].sort((a, b) => {
      const da = new Date(a.refundRequestedAt || 0);
      const db = new Date(b.refundRequestedAt || 0);
      return sortBy === 'dateDesc' ? db - da : da - db;
    });
    return result;
  }, [list, searchQuery, sortBy]);

  const fetchList = useCallback(async () => {
    try {
      setLoading(true);
      setError(null);
      const response = await axios.get(endpoints.refundRequests.list);
      if (response.data.success && Array.isArray(response.data.data)) {
        setList(response.data.data);
      } else {
        setList([]);
      }
    } catch (err) {
      console.error('Error fetching refund requests:', err);
      setError(err?.message || 'Failed to load refund requests');
      setList([]);
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    fetchList();
  }, [fetchList]);

  // Load document preview (blob URL) for inline viewing when dialog opens or tab changes
  useEffect(() => {
    if (!documentsBill) {
      if (previewBlobUrlRef.current) {
        URL.revokeObjectURL(previewBlobUrlRef.current);
        previewBlobUrlRef.current = null;
      }
      setPreviewBlobUrl(null);
      setPreviewLoading(false);
      return;
    }
    const key =
      docViewTab === 0
        ? documentsBill.pdfKey
        : documentsBill.supportingDocuments?.[docViewTab - 1]?.pdfKey;
    if (!key) {
      setPreviewBlobUrl(null);
      setPreviewLoading(false);
      return;
    }
    if (previewBlobUrlRef.current) {
      URL.revokeObjectURL(previewBlobUrlRef.current);
      previewBlobUrlRef.current = null;
    }
    setPreviewBlobUrl(null);
    setPreviewLoading(true);
    axios
      .get(endpoints.documents.preview(key), { responseType: 'blob' })
      .then((res) => {
        const url = URL.createObjectURL(res.data);
        previewBlobUrlRef.current = url;
        setPreviewBlobUrl(url);
      })
      .catch(() => setPreviewBlobUrl(null))
      .finally(() => setPreviewLoading(false));
    return () => {
      if (previewBlobUrlRef.current) {
        URL.revokeObjectURL(previewBlobUrlRef.current);
        previewBlobUrlRef.current = null;
      }
    };
  }, [documentsBill, docViewTab]);

  const openConfirm = (userId, bill, action) => {
    setConfirmPayload({ userId, billId: bill._id, bill, action });
    setConfirmOpen(true);
  };

  const closeConfirm = () => {
    if (!processingId) {
      setConfirmOpen(false);
      setConfirmPayload(null);
    }
  };

  const processRefund = async () => {
    if (!confirmPayload) return;
    const { userId, billId, action } = confirmPayload;
    setProcessingId(billId);
    setProcessingAction(action);
    setConfirmOpen(false);
    setConfirmPayload(null);
    try {
      await axios.patch(endpoints.refundRequests.processRefund(userId, billId), {
        action,
      });
      await fetchList();
    } catch (err) {
      console.error('Error processing refund:', err);
      setError(err?.message || `Failed to ${action} refund`);
    } finally {
      setProcessingId(null);
      setProcessingAction(null);
    }
  };

  const isApprove = confirmPayload?.action === 'approve';
  const confirmTitle = isApprove ? 'Approve refund?' : 'Reject refund request?';
  const confirmMessage = isApprove
    ? 'The customer will receive the $299 flat fee back via Stripe. This cannot be undone.'
    : 'The refund request will be marked as rejected. The customer will not receive a refund.';

  return (
    <DashboardContent maxWidth="xl">
      <Stack spacing={3}>
        <Stack direction="row" alignItems="center" justifyContent="space-between" sx={{ flexWrap: 'wrap', gap: 2 }}>
          <Box>
            <Typography variant="h4">Refund Requests</Typography>
            <Typography variant="body2" color="text.secondary">
              Bills where the user paid the flat fee and requested a refund. Approve or reject each request.
            </Typography>
          </Box>
          <TextField
            size="small"
            placeholder="Search by user or patient name"
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            sx={{ minWidth: 220 }}
          />
          <FormControl size="small" sx={{ minWidth: 180 }}>
            <InputLabel>Sort by</InputLabel>
            <Select
              value={sortBy}
              label="Sort by"
              onChange={(e) => setSortBy(e.target.value)}
            >
              <MenuItem value="dateDesc">Newest first</MenuItem>
              <MenuItem value="dateAsc">Oldest first</MenuItem>
            </Select>
          </FormControl>
        </Stack>

        <Card>
          {error && (
            <Alert severity="error" sx={{ m: 2 }} onClose={() => setError(null)}>
              {error}
            </Alert>
          )}

          {loading ? (
            <Box sx={{ display: 'flex', justifyContent: 'center', py: 8 }}>
              <CircularProgress />
            </Box>
          ) : (
            <TableContainer>
              <Table>
                <TableHead>
                  <TableRow>
                    <TableCell>User</TableCell>
                    <TableCell>Patient / Bill</TableCell>
                    <TableCell align="right">Bill amount</TableCell>
                    <TableCell>Requested at</TableCell>
                    <TableCell>Documents</TableCell>
                    <TableCell align="right">Actions</TableCell>
                  </TableRow>
                </TableHead>
                <TableBody>
                  {filteredList.length === 0 ? (
                    <TableRow>
                      <TableCell colSpan={6} align="center" sx={{ py: 4 }}>
                        <Typography variant="body2" color="text.secondary">
                          {list.length === 0
                            ? 'No refund requests at the moment.'
                            : 'No refund requests match your search.'}
                        </Typography>
                      </TableCell>
                    </TableRow>
                  ) : (
                    filteredList.map((row) => {
                      const bill = row;
                      const userId = bill.userId?.toString?.() || bill.userId;
                      const isProcessing =
                        processingId === bill._id;
                      const isApproving = isProcessing && processingAction === 'approve';
                      const isRejecting = isProcessing && processingAction === 'reject';
                      return (
                        <TableRow key={bill._id} hover>
                          <TableCell>
                            <Typography variant="body2" fontWeight={500}>
                              {getDisplayName(bill.user)}
                            </Typography>
                            {bill.user?.email && (
                              <Typography variant="caption" color="text.secondary">
                                {bill.user.email}
                              </Typography>
                            )}
                          </TableCell>
                          <TableCell>
                            <Typography variant="body2">{bill.patientName || '—'}</Typography>
                            <Typography variant="caption" color="text.secondary">
                              Bill ID: {String(bill._id).slice(-8)}
                            </Typography>
                          </TableCell>
                          <TableCell align="right">
                            $
                            {(bill.revisedAmount != null ? bill.revisedAmount : bill.billAmount) != null
                              ? Number(bill.revisedAmount != null ? bill.revisedAmount : bill.billAmount).toLocaleString(undefined, {
                                  minimumFractionDigits: 2,
                                  maximumFractionDigits: 2,
                                })
                              : '—'}
                            {bill.revisedAmount != null && (
                              <Typography component="span" variant="caption" display="block" color="text.secondary">
                                Revised
                              </Typography>
                            )}
                          </TableCell>
                          <TableCell>{formatDate(bill.refundRequestedAt)}</TableCell>
                          <TableCell>
                            <Button
                              size="small"
                              variant="outlined"
                              startIcon={<Iconify icon="solar:document-bold-duotone" />}
                              onClick={() => {
                                setDocumentsBill(bill);
                                setDocViewTab(0);
                              }}
                            >
                              View PDF & docs
                            </Button>
                          </TableCell>
                          <TableCell align="right">
                            <Stack direction="row" spacing={1} justifyContent="flex-end">
                              <Button
                                size="small"
                                variant="contained"
                                color="success"
                                disabled={isProcessing}
                                startIcon={
                                  isApproving ? (
                                    <CircularProgress size={14} color="inherit" />
                                  ) : (
                                    <Iconify icon="eva:checkmark-circle-2-fill" />
                                  )
                                }
                                onClick={() => openConfirm(userId, bill, 'approve')}
                              >
                                Approve
                              </Button>
                              <Button
                                size="small"
                                variant="contained"
                                color="error"
                                disabled={isProcessing}
                                startIcon={
                                  isRejecting ? (
                                    <CircularProgress size={14} color="inherit" />
                                  ) : (
                                    <Iconify icon="eva:close-circle-fill" />
                                  )
                                }
                                onClick={() => openConfirm(userId, bill, 'reject')}
                              >
                                Reject
                              </Button>
                            </Stack>
                          </TableCell>
                        </TableRow>
                      );
                    })
                  )}
                </TableBody>
              </Table>
            </TableContainer>
          )}
        </Card>

        <Dialog open={confirmOpen} onClose={closeConfirm} maxWidth="sm" fullWidth>
          <DialogTitle>{confirmTitle}</DialogTitle>
          <DialogContent>
            {confirmPayload && (
              <Typography variant="body2" color="text.secondary" sx={{ mt: 0.5 }}>
                {confirmMessage}
              </Typography>
            )}
            {confirmPayload?.bill && (
              <Typography variant="body2" sx={{ mt: 2 }}>
                <strong>{getDisplayName(confirmPayload.bill.user)}</strong>
                {confirmPayload.bill.patientName && ` · ${confirmPayload.bill.patientName}`}
              </Typography>
            )}
          </DialogContent>
          <DialogActions sx={{ px: 3, pb: 2 }}>
            <Button onClick={closeConfirm} disabled={!!processingId}>
              Cancel
            </Button>
            <Button
              variant="contained"
              color={isApprove ? 'success' : 'error'}
              onClick={processRefund}
              disabled={!!processingId}
              startIcon={
                processingId && confirmPayload?.billId === processingId ? (
                  <CircularProgress size={16} color="inherit" />
                ) : null
              }
            >
              {isApprove ? 'Approve refund' : 'Reject request'}
            </Button>
          </DialogActions>
        </Dialog>

        {/* Bill documents dialog: view in dashboard (inline PDF) + download */}
        <Dialog
          open={!!documentsBill}
          onClose={() => setDocumentsBill(null)}
          maxWidth="lg"
          fullWidth
          PaperProps={{ sx: { minHeight: '80vh' } }}
        >
          <DialogTitle>
            Bill documents — view in dashboard
            {documentsBill?.patientName && (
              <Typography component="span" variant="body2" color="text.secondary" sx={{ ml: 1 }}>
                {documentsBill.patientName}
              </Typography>
            )}
          </DialogTitle>
          <DialogContent dividers>
            {documentsBill && (
              <Stack spacing={2}>
                <Tabs
                  value={docViewTab}
                  onChange={(_, v) => setDocViewTab(v)}
                  variant="scrollable"
                  scrollButtons="auto"
                  sx={{ borderBottom: 1, borderColor: 'divider', minHeight: 48 }}
                >
                  <Tab
                    label={documentsBill.pdfUrl ? 'Bill PDF' : 'Bill PDF (none)'}
                    id="refund-doc-tab-0"
                    aria-controls="refund-doc-panel-0"
                  />
                  {(documentsBill.supportingDocuments || []).map((doc, idx) => (
                    <Tab
                      key={doc._id || idx}
                      label={
                        doc.documentType
                          ? getDocumentTypeLabel(doc.documentType)
                          : `Document ${idx + 1}`
                      }
                      id={`refund-doc-tab-${idx + 1}`}
                      aria-controls={`refund-doc-panel-${idx + 1}`}
                    />
                  ))}
                </Tabs>

                <Box sx={{ flex: 1, minHeight: 480, display: 'flex', flexDirection: 'column' }}>
                  {docViewTab === 0 && !documentsBill.pdfKey ? (
                    <Typography variant="body2" color="text.secondary">
                      No bill PDF uploaded.
                    </Typography>
                  ) : docViewTab > 0 && !documentsBill.supportingDocuments?.[docViewTab - 1]?.pdfKey ? (
                    <Typography variant="body2" color="text.secondary">
                      No document.
                    </Typography>
                  ) : (
                    <>
                      <Stack direction="row" alignItems="center" spacing={1} sx={{ mb: 1 }}>
                        {docViewTab === 0 ? (
                          <Button
                            size="small"
                            variant="outlined"
                            href={documentsBill.pdfUrl}
                            target="_blank"
                            rel="noopener noreferrer"
                            startIcon={<Iconify icon="solar:download-minimalistic-bold" />}
                          >
                            Download bill PDF
                          </Button>
                        ) : (
                          (() => {
                            const doc = documentsBill.supportingDocuments[docViewTab - 1];
                            return (
                              <Button
                                size="small"
                                variant="outlined"
                                href={doc?.pdfUrl}
                                target="_blank"
                                rel="noopener noreferrer"
                                startIcon={<Iconify icon="solar:download-minimalistic-bold" />}
                              >
                                Download {doc?.documentType ? getDocumentTypeLabel(doc.documentType) : 'document'}
                              </Button>
                            );
                          })()
                        )}
                      </Stack>
                      {previewLoading ? (
                        <Box sx={{ display: 'flex', alignItems: 'center', justifyContent: 'center', minHeight: 440 }}>
                          <CircularProgress />
                        </Box>
                      ) : previewBlobUrl ? (
                        <Box
                          component="iframe"
                          src={previewBlobUrl}
                          title={docViewTab === 0 ? 'Bill PDF' : documentsBill.supportingDocuments?.[docViewTab - 1]?.pdfFileName || 'Document'}
                          sx={{
                            flex: 1,
                            width: '100%',
                            minHeight: 440,
                            border: '1px solid',
                            borderColor: 'divider',
                            borderRadius: 1,
                          }}
                        />
                      ) : (
                        <Typography variant="body2" color="text.secondary">
                          Could not load preview.
                        </Typography>
                      )}
                    </>
                  )}
                </Box>
              </Stack>
            )}
          </DialogContent>
          <DialogActions>
            <Button onClick={() => setDocumentsBill(null)}>Close</Button>
          </DialogActions>
        </Dialog>
      </Stack>
    </DashboardContent>
  );
}
