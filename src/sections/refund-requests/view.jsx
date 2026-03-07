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

export function RefundRequestsView() {
  const [list, setList] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);
  const [processingId, setProcessingId] = useState(null);
  const [processingAction, setProcessingAction] = useState(null);
  const [confirmOpen, setConfirmOpen] = useState(false);
  const [confirmPayload, setConfirmPayload] = useState(null);

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
        <Typography variant="h4">Refund Requests</Typography>
        <Typography variant="body2" color="text.secondary">
          Bills where the user paid the flat fee and requested a refund. Approve or reject each request.
        </Typography>

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
                    <TableCell align="right">Actions</TableCell>
                  </TableRow>
                </TableHead>
                <TableBody>
                  {list.length === 0 ? (
                    <TableRow>
                      <TableCell colSpan={5} align="center" sx={{ py: 4 }}>
                        <Typography variant="body2" color="text.secondary">
                          No refund requests at the moment.
                        </Typography>
                      </TableCell>
                    </TableRow>
                  ) : (
                    list.map((row) => {
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
      </Stack>
    </DashboardContent>
  );
}
