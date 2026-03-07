import { useState, useEffect, useCallback, useMemo } from 'react';

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
import TablePagination from '@mui/material/TablePagination';
import Typography from '@mui/material/Typography';
import Chip from '@mui/material/Chip';
import CircularProgress from '@mui/material/CircularProgress';
import Alert from '@mui/material/Alert';
import Dialog from '@mui/material/Dialog';
import DialogTitle from '@mui/material/DialogTitle';
import DialogContent from '@mui/material/DialogContent';
import DialogActions from '@mui/material/DialogActions';

import { DashboardContent } from 'src/layouts/dashboard';
import { Iconify } from 'src/components/iconify';
import axios, { endpoints } from 'src/utils/axios';

// Document type labels (match page-one / app)
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
  });
}

// Flatten users + bills into rows (include inactive so admin can see and delete them)
function flattenBills(users) {
  if (!Array.isArray(users)) return [];
  const rows = [];
  users.forEach((user) => {
    const bills = user.bills || [];
    bills.forEach((bill) => {
      rows.push({
        ...bill,
        userId: user._id,
        userDisplayName: getDisplayName(user),
        userEmail: user.email,
      });
    });
  });
  return rows;
}

function getDisplayStatus(bill) {
  const s = (bill.status || '').toLowerCase();
  if (s === 'inactive') return 'Incomplete';
  return bill.status || 'pending';
}

// ----------------------------------------------------------------------

export function PageTwoView() {
  const [bills, setBills] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);
  const [updatingBillId, setUpdatingBillId] = useState(null);
  const [updatingAction, setUpdatingAction] = useState(null); // 'approved' | 'rejected'
  const [documentsBill, setDocumentsBill] = useState(null); // bill for documents dialog
  const [billToDelete, setBillToDelete] = useState(null);
  const [deletingBillId, setDeletingBillId] = useState(null);
  const [page, setPage] = useState(0);
  const [rowsPerPage, setRowsPerPage] = useState(10);

  const paginatedBills = useMemo(
    () =>
      bills.slice(page * rowsPerPage, page * rowsPerPage + rowsPerPage),
    [bills, page, rowsPerPage]
  );

  const fetchBills = useCallback(async () => {
    try {
      setLoading(true);
      setError(null);
      const response = await axios.get(endpoints.users.list, {
        params: { page: 1, limit: 200 },
      });
      if (response.data.success && Array.isArray(response.data.data)) {
        setBills(flattenBills(response.data.data));
      } else {
        setBills([]);
      }
    } catch (err) {
      console.error('Error fetching bills:', err);
      setError(err.response?.data?.message || 'Failed to load bills');
      setBills([]);
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    fetchBills();
  }, [fetchBills]);

  const updateStatus = async (userId, billId, status) => {
    if (!userId || !billId) return;
    setUpdatingBillId(billId);
    setUpdatingAction(status);
    try {
      await axios.patch(endpoints.users.updateBillStatus(userId, billId), { status });
      await fetchBills();
    } catch (err) {
      console.error('Error updating bill status:', err);
      setError(err.response?.data?.message || 'Failed to update status');
    } finally {
      setUpdatingBillId(null);
      setUpdatingAction(null);
    }
  };

  const canChangeStatus = (bill) => {
    const s = (bill.status || '').toLowerCase();
    if (s === 'inactive') return false;
    return s === 'pending' || s === 'submitted' || s === 'processing';
  };

  const isBillInactive = (bill) => (bill.status || '').toLowerCase() === 'inactive';

  const getStatusColor = (status, bill) => {
    const s = (status || '').toLowerCase();
    if (s === 'inactive' || (bill && (bill.status || '').toLowerCase() === 'inactive')) return 'warning';
    if (s === 'approved') return 'success';
    if (s === 'rejected') return 'error';
    if (s === 'submitted' || s === 'processing') return 'info';
    return 'default';
  };

  const handleDeleteBillClick = (bill) => {
    setBillToDelete(bill);
  };

  const handleConfirmDeleteBill = async () => {
    if (!billToDelete?.userId || !billToDelete?._id) return;
    setDeletingBillId(billToDelete._id);
    try {
      await axios.delete(endpoints.users.deleteBill(billToDelete.userId, billToDelete._id));
      setBills((prev) => prev.filter((b) => !(b.userId === billToDelete.userId && b._id === billToDelete._id)));
      setBillToDelete(null);
    } catch (err) {
      console.error('Error deleting bill:', err);
      setError(err?.message || 'Failed to delete bill');
    } finally {
      setDeletingBillId(null);
    }
  };

  const handleChangePage = (event, newPage) => {
    setPage(newPage);
  };

  const handleChangeRowsPerPage = (event) => {
    setRowsPerPage(parseInt(event.target.value, 10));
    setPage(0);
  };

  return (
    <DashboardContent maxWidth="xl">
      <Stack spacing={3}>
        <Typography variant="h4">Hospital Bill Approval</Typography>

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
                    <TableCell>Patient name</TableCell>
                    <TableCell align="right">Bill amount</TableCell>
                    <TableCell align="right">Revised amount</TableCell>
                    <TableCell>Service date</TableCell>
                    <TableCell>Status</TableCell>
                    <TableCell>Documents</TableCell>
                    <TableCell align="right">Actions</TableCell>
                  </TableRow>
                </TableHead>
                <TableBody>
                  {paginatedBills.length === 0 ? (
                    <TableRow>
                      <TableCell colSpan={8} align="center" sx={{ py: 4 }}>
                        <Typography variant="body2" color="text.secondary">
                          No bills to review.
                        </Typography>
                      </TableCell>
                    </TableRow>
                  ) : (
                    paginatedBills.map((bill) => {
                      const isUpdating = updatingBillId === bill._id;
                      const isApproving = isUpdating && updatingAction === 'approved';
                      const isRejecting = isUpdating && updatingAction === 'rejected';
                      const canChange = canChangeStatus(bill);
                      return (
                        <TableRow key={`${bill.userId}-${bill._id}`} hover>
                          <TableCell>
                            <Typography variant="body2" fontWeight={500}>
                              {bill.userDisplayName}
                            </Typography>
                            {bill.userEmail && (
                              <Typography variant="caption" color="text.secondary">
                                {bill.userEmail}
                              </Typography>
                            )}
                          </TableCell>
                          <TableCell>{bill.patientName || '—'}</TableCell>
                          <TableCell align="right">
                            {bill.revisedAmount != null ? (
                              <>
                                ${Number(bill.revisedAmount).toLocaleString()}
                                <Typography component="span" variant="caption" display="block" color="text.secondary">
                                  (Revised · orig. ${bill.billAmount != null ? Number(bill.billAmount).toLocaleString() : '—'})
                                </Typography>
                              </>
                            ) : (
                              bill.billAmount != null ? `$${Number(bill.billAmount).toLocaleString()}` : '—'
                            )}
                          </TableCell>
                          <TableCell align="right">
                            {bill.revisedAmount != null
                              ? `$${Number(bill.revisedAmount).toLocaleString()}`
                              : '—'}
                          </TableCell>
                          <TableCell>{formatDate(bill.serviceDate)}</TableCell>
                          <TableCell>
                            <Chip
                              label={getDisplayStatus(bill)}
                              color={getStatusColor(bill.status, bill)}
                              size="small"
                              variant="outlined"
                              title={isBillInactive(bill) ? 'User has not completed this bill yet. You can delete it.' : undefined}
                            />
                          </TableCell>
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
                            <Stack direction="row" spacing={1} justifyContent="flex-end" alignItems="center">
                              {canChange ? (
                                <>
                                  <Button
                                    size="small"
                                    variant="contained"
                                    color="success"
                                    disabled={isUpdating}
                                    startIcon={
                                      isApproving ? (
                                        <CircularProgress size={14} color="inherit" />
                                      ) : (
                                        <Iconify icon="eva:checkmark-circle-2-fill" />
                                      )
                                    }
                                    onClick={() =>
                                      updateStatus(bill.userId, bill._id, 'approved')
                                    }
                                  >
                                    Approve
                                  </Button>
                                  <Button
                                    size="small"
                                    variant="contained"
                                    color="error"
                                    disabled={isUpdating}
                                    startIcon={
                                      isRejecting ? (
                                        <CircularProgress size={14} color="inherit" />
                                      ) : (
                                        <Iconify icon="eva:close-circle-fill" />
                                      )
                                    }
                                    onClick={() =>
                                      updateStatus(bill.userId, bill._id, 'rejected')
                                    }
                                  >
                                    Reject
                                  </Button>
                                </>
                              ) : (
                                <Typography variant="caption" color="text.secondary" sx={{ mr: 1 }}>
                                  {isBillInactive(bill)
                                    ? 'Complete to approve'
                                    : bill.status === 'approved'
                                      ? 'Approved'
                                      : bill.status === 'rejected'
                                        ? 'Rejected'
                                        : '—'}
                                </Typography>
                              )}
                              <Button
                                size="small"
                                variant="outlined"
                                color="error"
                                disabled={deletingBillId === bill._id}
                                startIcon={
                                  deletingBillId === bill._id ? (
                                    <CircularProgress size={14} color="inherit" />
                                  ) : (
                                    <Iconify icon="solar:trash-bin-trash-bold" />
                                  )
                                }
                                onClick={() => handleDeleteBillClick(bill)}
                                title="Delete bill"
                              >
                                Delete
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

          {!loading && bills.length > 0 && (
            <TablePagination
              component="div"
              count={bills.length}
              page={page}
              onPageChange={handleChangePage}
              rowsPerPage={rowsPerPage}
              onRowsPerPageChange={handleChangeRowsPerPage}
              rowsPerPageOptions={[5, 10, 25, 50]}
            />
          )}
        </Card>

        {/* Documents dialog: Bill PDF + Supporting documents */}
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

        {/* Delete bill confirmation */}
        <Dialog open={!!billToDelete} onClose={() => setBillToDelete(null)} maxWidth="xs" fullWidth>
          <DialogTitle>Delete bill?</DialogTitle>
          <DialogContent>
            <Typography variant="body2" color="text.secondary">
              {billToDelete?.patientName && (
                <>
                  This will permanently delete the bill for <strong>{billToDelete.patientName}</strong> and all
                  associated documents. This cannot be undone.
                </>
              )}
              {!billToDelete?.patientName && 'This will permanently delete the bill and all associated documents. This cannot be undone.'}
            </Typography>
          </DialogContent>
          <DialogActions sx={{ px: 3, pb: 2 }}>
            <Button onClick={() => setBillToDelete(null)}>Cancel</Button>
            <Button
              variant="contained"
              color="error"
              onClick={handleConfirmDeleteBill}
              disabled={!!deletingBillId}
              startIcon={deletingBillId ? <CircularProgress size={16} color="inherit" /> : null}
            >
              {deletingBillId ? 'Deleting…' : 'Delete'}
            </Button>
          </DialogActions>
        </Dialog>
      </Stack>
    </DashboardContent>
  );
}
