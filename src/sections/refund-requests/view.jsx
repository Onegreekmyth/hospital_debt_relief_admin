import { useState, useEffect, useCallback } from 'react';

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

  const filteredList = list.filter((row) => matchesSearch(row, searchQuery));

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
            sx={{ minWidth: 300 }}
          />
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
                              onClick={() => setDocumentsBill(bill)}
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

        {/* Bill documents dialog: PDF + supporting documents (same as Bill Approval) */}
        <Dialog
          open={!!documentsBill}
          onClose={() => setDocumentsBill(null)}
          maxWidth="sm"
          fullWidth
        >
          <DialogTitle>
            Bill documents
            {documentsBill?.patientName && (
              <Typography component="span" variant="body2" color="text.secondary" sx={{ ml: 1 }}>
                — {documentsBill.patientName}
              </Typography>
            )}
          </DialogTitle>
          <DialogContent dividers>
            {documentsBill && (
              <Stack spacing={3}>
                <Box>
                  <Typography variant="subtitle2" sx={{ mb: 1 }}>
                    Bill PDF
                  </Typography>
                  {documentsBill.pdfUrl ? (
                    <Button
                      size="small"
                      variant="outlined"
                      href={documentsBill.pdfUrl}
                      target="_blank"
                      rel="noopener noreferrer"
                      startIcon={<Iconify icon="solar:document-bold-duotone" />}
                    >
                      {documentsBill.pdfFileName || 'View bill PDF'}
                    </Button>
                  ) : (
                    <Typography variant="body2" color="text.secondary">
                      No bill PDF uploaded.
                    </Typography>
                  )}
                </Box>

                <Box>
                  <Typography variant="subtitle2" sx={{ mb: 1 }}>
                    Supporting documents
                    {documentsBill.supportingDocuments?.length > 0 &&
                      ` (${documentsBill.supportingDocuments.length})`}
                  </Typography>
                  {!documentsBill.supportingDocuments?.length ? (
                    <Typography variant="body2" color="text.secondary">
                      No supporting documents.
                    </Typography>
                  ) : (
                    <Stack direction="row" spacing={1} flexWrap="wrap" useFlexGap>
                      {documentsBill.supportingDocuments.map((doc, idx) => (
                        <Button
                          key={doc._id || idx}
                          size="small"
                          variant="outlined"
                          href={doc.pdfUrl}
                          target="_blank"
                          rel="noopener noreferrer"
                          startIcon={<Iconify icon="solar:document-bold-duotone" />}
                        >
                          {doc.documentType
                            ? `${getDocumentTypeLabel(doc.documentType)}: `
                            : ''}
                          {doc.pdfFileName || `Document ${idx + 1}`}
                        </Button>
                      ))}
                    </Stack>
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
