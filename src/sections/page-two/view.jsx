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
import TableSortLabel from '@mui/material/TableSortLabel';
import TableContainer from '@mui/material/TableContainer';
import TablePagination from '@mui/material/TablePagination';
import TextField from '@mui/material/TextField';
import Typography from '@mui/material/Typography';
import Chip from '@mui/material/Chip';
import CircularProgress from '@mui/material/CircularProgress';
import Alert from '@mui/material/Alert';
import Dialog from '@mui/material/Dialog';
import DialogTitle from '@mui/material/DialogTitle';
import DialogContent from '@mui/material/DialogContent';
import DialogActions from '@mui/material/DialogActions';
import IconButton from '@mui/material/IconButton';
import Menu from '@mui/material/Menu';
import MenuItem from '@mui/material/MenuItem';
import Tabs from '@mui/material/Tabs';
import Tab from '@mui/material/Tab';

import { useNavigate } from 'react-router-dom';

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
  if (s === 'application_added') return 'Application Added';
  if (s === 'application_submitted') return 'Application Submitted';
  if (s === 'application_info_requested') return 'Info Requested';
  return bill.status || 'pending';
}

function getHipaaEmailConsentLabel(value) {
  if (value === 'unencrypted_consent') return 'Unencrypted email consent';
  if (value === 'encrypted_required') return 'Encrypted email required';
  return null;
}

function matchesBillSearch(bill, query) {
  if (!query || !String(query).trim()) return true;
  const q = String(query).trim().toLowerCase();
  const user = (bill.userDisplayName || '').toLowerCase();
  const email = (bill.userEmail || '').toLowerCase();
  const patient = (bill.patientName || '').toLowerCase();
  return user.includes(q) || email.includes(q) || patient.includes(q);
}

const STATUS_FILTER_OPTIONS = [
  { value: 'all', label: 'All statuses' },
  { value: 'pending', label: 'Pending' },
  { value: 'submitted', label: 'Submitted' },
  { value: 'processing', label: 'Processing' },
  { value: 'approved', label: 'Approved' },
  { value: 'rejected', label: 'Rejected' },
  { value: 'inactive', label: 'Incomplete' },
  { value: 'application_added', label: 'Application Added' },
  { value: 'application_submitted', label: 'Application Submitted' },
  { value: 'application_info_requested', label: 'Info Requested' },
];

function filterByStatus(bill, statusFilter) {
  if (!statusFilter || statusFilter === 'all') return true;
  const s = (bill.status || '').toLowerCase();
  return s === statusFilter.toLowerCase();
}

function sortBills(list, sortBy) {
  const arr = [...list];
  switch (sortBy) {
    case 'dateDesc':
      arr.sort((a, b) => new Date(b.createdAt || 0) - new Date(a.createdAt || 0));
      break;
    case 'dateAsc':
      arr.sort((a, b) => new Date(a.createdAt || 0) - new Date(b.createdAt || 0));
      break;
    case 'amountDesc':
      arr.sort((a, b) => (Number(b.revisedAmount ?? b.billAmount ?? 0) - Number(a.revisedAmount ?? a.billAmount ?? 0)));
      break;
    case 'amountAsc':
      arr.sort((a, b) => (Number(a.revisedAmount ?? a.billAmount ?? 0) - Number(b.revisedAmount ?? b.billAmount ?? 0)));
      break;
    case 'userAsc':
      arr.sort((a, b) => (a.userDisplayName || '').localeCompare(b.userDisplayName || ''));
      break;
    case 'userDesc':
      arr.sort((a, b) => (b.userDisplayName || '').localeCompare(a.userDisplayName || ''));
      break;
    default:
      break;
  }
  return arr;
}

// ----------------------------------------------------------------------

function getSortByFromHeader(column, direction) {
  if (column === 'user') return direction === 'asc' ? 'userAsc' : 'userDesc';
  if (column === 'amount') return direction === 'asc' ? 'amountAsc' : 'amountDesc';
  if (column === 'date') return direction === 'asc' ? 'dateAsc' : 'dateDesc';
  return 'dateDesc';
}

function getHeaderSortDirection(sortBy, column) {
  if (column === 'user') return sortBy === 'userAsc' ? 'asc' : sortBy === 'userDesc' ? 'desc' : false;
  if (column === 'amount') return sortBy === 'amountAsc' ? 'asc' : sortBy === 'amountDesc' ? 'desc' : false;
  if (column === 'date') return sortBy === 'dateAsc' ? 'asc' : sortBy === 'dateDesc' ? 'desc' : false;
  return false;
}

export function PageTwoView() {
  const nav = useNavigate();
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
  const [searchQuery, setSearchQuery] = useState('');
  const [statusFilter, setStatusFilter] = useState('all');
  const [sortBy, setSortBy] = useState('dateDesc');
  const [statusMenuAnchor, setStatusMenuAnchor] = useState(null);
  const [docViewTab, setDocViewTab] = useState(0); // 0 = bill PDF, 1+ = supporting doc index
  const [previewBlobUrl, setPreviewBlobUrl] = useState(null);
  const [previewLoading, setPreviewLoading] = useState(false);
  const previewBlobUrlRef = useRef(null);

  // Application Form state
  const [appFormDialogBill, setAppFormDialogBill] = useState(null); // bill for upload dialog
  const [appFormFile, setAppFormFile] = useState(null);
  const [uploadingAppForm, setUploadingAppForm] = useState(false);
  const [requestChangesDialogBill, setRequestChangesDialogBill] = useState(null);
  const [requestChangesNote, setRequestChangesNote] = useState('');
  const [requestingChanges, setRequestingChanges] = useState(false);
  const documentTabs = useMemo(() => {
    if (!documentsBill) return [];
    const tabs = [
      {
        label: documentsBill.pdfUrl ? 'Bill PDF' : 'Bill PDF (none)',
        key: documentsBill.pdfKey,
        url: documentsBill.pdfUrl,
        title: 'Bill PDF',
        downloadLabel: 'Download bill PDF',
      },
    ];
    if (documentsBill.electronicConsentForm) {
      tabs.push({
        label: 'Electronic Consent Form',
        key: documentsBill.electronicConsentForm.pdfKey,
        url: documentsBill.electronicConsentForm.pdfUrl,
        title: 'Electronic Consent Form',
        downloadLabel: 'Download electronic consent form',
      });
    }
    if (documentsBill.applicationForm?.pdfUrl) {
      tabs.push({
        label: 'Application Form (Original)',
        key: documentsBill.applicationForm.pdfKey,
        url: documentsBill.applicationForm.pdfUrl,
        title: 'Application Form (Original)',
        downloadLabel: 'Download application form (original)',
      });
    }
    if (documentsBill.applicationForm?.editedPdfUrl) {
      tabs.push({
        label: 'Application Form (Edited)',
        key: documentsBill.applicationForm.editedPdfKey,
        url: documentsBill.applicationForm.editedPdfUrl,
        title: 'Application Form (Edited)',
        downloadLabel: 'Download application form (edited)',
      });
    }
    (documentsBill.supportingDocuments || []).forEach((doc, idx) => {
      tabs.push({
        label: doc.documentType ? getDocumentTypeLabel(doc.documentType) : `Document ${idx + 1}`,
        key: doc.pdfKey,
        url: doc.pdfUrl,
        title: doc.pdfFileName || `Document ${idx + 1}`,
        downloadLabel: `Download ${doc.documentType ? getDocumentTypeLabel(doc.documentType) : 'document'}`,
      });
    });
    return tabs;
  }, [documentsBill]);

  const filteredBills = useMemo(() => {
    let list = bills.filter((bill) => matchesBillSearch(bill, searchQuery));
    list = list.filter((bill) => filterByStatus(bill, statusFilter));
    return sortBills(list, sortBy);
  }, [bills, searchQuery, statusFilter, sortBy]);

  const paginatedBills = useMemo(
    () =>
      filteredBills.slice(page * rowsPerPage, page * rowsPerPage + rowsPerPage),
    [filteredBills, page, rowsPerPage]
  );

  const fetchBills = useCallback(async () => {
    try {
      setLoading(true);
      setError(null);
      const response = await axios.get(endpoints.users.list, {
        params: { page: 1, limit: 500 },
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

  // Load document preview (blob URL) for inline viewing when dialog opens or tab changes
  useEffect(() => {
    const cleanup = () => {
      if (previewBlobUrlRef.current) {
        URL.revokeObjectURL(previewBlobUrlRef.current);
        previewBlobUrlRef.current = null;
      }
    };

    if (!documentsBill) {
      cleanup();
      setPreviewBlobUrl(null);
      setPreviewLoading(false);
      return undefined;
    }
    const key = documentTabs[docViewTab]?.key;
    if (!key) {
      setPreviewBlobUrl(null);
      setPreviewLoading(false);
      return undefined;
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

    return cleanup;
  }, [documentsBill, docViewTab, documentTabs]);

  useEffect(() => {
    if (docViewTab >= documentTabs.length) {
      setDocViewTab(0);
    }
  }, [docViewTab, documentTabs.length]);

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

  const canUploadAppForm = (bill) => {
    const s = (bill.status || '').toLowerCase();
    return s !== 'inactive';
  };

  const canRequestChanges = (bill) => {
    const s = (bill.status || '').toLowerCase();
    return s === 'application_submitted';
  };

  const handleUploadAppForm = async () => {
    if (!appFormDialogBill || !appFormFile || uploadingAppForm) return;
    setUploadingAppForm(true);
    try {
      const formData = new FormData();
      formData.append('pdf', appFormFile);
      await axios.post(
        endpoints.users.uploadApplicationForm
          ? endpoints.users.uploadApplicationForm(appFormDialogBill.userId, appFormDialogBill._id)
          : `/api/v1/admin/users/${appFormDialogBill.userId}/bills/${appFormDialogBill._id}/application-form`,
        formData,
        { headers: { 'Content-Type': 'multipart/form-data' } }
      );
      setAppFormDialogBill(null);
      setAppFormFile(null);
      await fetchBills();
    } catch (err) {
      console.error('Error uploading application form:', err);
      setError(err?.message || 'Failed to upload application form');
    } finally {
      setUploadingAppForm(false);
    }
  };

  const handleRequestChanges = async () => {
    if (!requestChangesDialogBill || requestingChanges) return;
    setRequestingChanges(true);
    try {
      await axios.patch(
        `/api/v1/admin/users/${requestChangesDialogBill.userId}/bills/${requestChangesDialogBill._id}/application-form/request-changes`,
        { note: requestChangesNote }
      );
      setRequestChangesDialogBill(null);
      setRequestChangesNote('');
      await fetchBills();
    } catch (err) {
      console.error('Error requesting changes:', err);
      setError(err?.message || 'Failed to request changes');
    } finally {
      setRequestingChanges(false);
    }
  };

  const getStatusColor = (status, bill) => {
    const s = (status || '').toLowerCase();
    if (s === 'inactive' || (bill && (bill.status || '').toLowerCase() === 'inactive')) return 'warning';
    if (s === 'approved') return 'success';
    if (s === 'rejected') return 'error';
    if (s === 'submitted' || s === 'processing') return 'info';
    if (s === 'application_added') return 'info';
    if (s === 'application_submitted') return 'success';
    if (s === 'application_info_requested') return 'warning';
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

  const handleChangeSearch = (event) => {
    setSearchQuery(event.target.value);
    setPage(0);
  };

  const handleHeaderSort = (column) => {
    const currentDirection = getHeaderSortDirection(sortBy, column);
    const nextDirection = currentDirection === 'asc' ? 'desc' : 'asc';
    setSortBy(getSortByFromHeader(column, nextDirection));
    setPage(0);
  };

  const handleOpenStatusMenu = (event) => {
    setStatusMenuAnchor(event.currentTarget);
  };

  const handleCloseStatusMenu = () => {
    setStatusMenuAnchor(null);
  };

  return (
    <DashboardContent maxWidth="xl">
      <Stack spacing={3}>
        <Stack direction="row" alignItems="center" justifyContent="space-between" sx={{ flexWrap: 'wrap', gap: 2 }}>
          <Typography variant="h4">Hospital Bill Approval</Typography>
          <TextField
            size="small"
            placeholder="Search by user or patient name"
            value={searchQuery}
            onChange={handleChangeSearch}
            sx={{ minWidth: 260 }}
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
                    <TableCell sortDirection={getHeaderSortDirection(sortBy, 'user') || false}>
                      <TableSortLabel
                        active={!!getHeaderSortDirection(sortBy, 'user')}
                        direction={getHeaderSortDirection(sortBy, 'user') || 'asc'}
                        onClick={() => handleHeaderSort('user')}
                      >
                        User
                      </TableSortLabel>
                    </TableCell>
                    <TableCell>Patient name</TableCell>
                    <TableCell align="right" sortDirection={getHeaderSortDirection(sortBy, 'amount') || false}>
                      <TableSortLabel
                        active={!!getHeaderSortDirection(sortBy, 'amount')}
                        direction={getHeaderSortDirection(sortBy, 'amount') || 'asc'}
                        onClick={() => handleHeaderSort('amount')}
                      >
                        Bill amount
                      </TableSortLabel>
                    </TableCell>
                    <TableCell align="right">Revised amount</TableCell>
                    <TableCell sortDirection={getHeaderSortDirection(sortBy, 'date') || false}>
                      <TableSortLabel
                        active={!!getHeaderSortDirection(sortBy, 'date')}
                        direction={getHeaderSortDirection(sortBy, 'date') || 'asc'}
                        onClick={() => handleHeaderSort('date')}
                      >
                        Service date
                      </TableSortLabel>
                    </TableCell>
                    <TableCell>
                      <Stack direction="row" spacing={0.5} alignItems="center">
                        <Typography variant="inherit">Status</Typography>
                        <IconButton
                          size="small"
                          onClick={handleOpenStatusMenu}
                          color={statusFilter !== 'all' ? 'primary' : 'default'}
                          title="Filter status"
                          aria-label="Filter status"
                        >
                          <Iconify icon="solar:filter-bold" width={16} />
                        </IconButton>
                      </Stack>
                    </TableCell>
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
                            {getHipaaEmailConsentLabel(bill.hipaaEmailConsent) && (
                              <Typography variant="caption" color="text.secondary" display="block" sx={{ mt: 0.5 }}>
                                {getHipaaEmailConsentLabel(bill.hipaaEmailConsent)}
                              </Typography>
                            )}
                          </TableCell>
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
                            <Stack direction="row" spacing={1} justifyContent="flex-end" alignItems="center" flexWrap="wrap">
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
                                        : bill.status === 'application_added'
                                          ? 'Awaiting user'
                                          : bill.status === 'application_info_requested'
                                            ? 'Awaiting user'
                                            : '—'}
                                </Typography>
                              )}
                              {/* Application Form Actions */}
                              {canUploadAppForm(bill) && (
                                <Button
                                  size="small"
                                  variant="outlined"
                                  color="primary"
                                  startIcon={<Iconify icon="solar:file-text-bold" />}
                                  onClick={() => {
                                    setAppFormDialogBill(bill);
                                    setAppFormFile(null);
                                  }}
                                  title={bill.applicationForm?.pdfUrl ? 'Replace application form' : 'Upload application form'}
                                >
                                  {bill.applicationForm?.pdfUrl ? 'Replace Form' : 'Add Form'}
                                </Button>
                              )}
                              {canRequestChanges(bill) && (
                                <Button
                                  size="small"
                                  variant="outlined"
                                  color="warning"
                                  startIcon={<Iconify icon="solar:pen-new-round-bold" />}
                                  onClick={() => {
                                    setRequestChangesDialogBill(bill);
                                    setRequestChangesNote('');
                                  }}
                                >
                                  Request Changes
                                </Button>
                              )}
                              {bill.applicationForm?.pdfUrl && (
                                <Button
                                  size="small"
                                  variant="outlined"
                                  color="secondary"
                                  startIcon={<Iconify icon="solar:document-add-bold" />}
                                  onClick={() => nav(`/dashboard/application-form/${bill.userId}/${bill._id}`)}
                                >
                                  Edit Form
                                </Button>
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

          <Menu
            anchorEl={statusMenuAnchor}
            open={Boolean(statusMenuAnchor)}
            onClose={handleCloseStatusMenu}
            anchorOrigin={{ vertical: 'bottom', horizontal: 'left' }}
            transformOrigin={{ vertical: 'top', horizontal: 'left' }}
          >
            {STATUS_FILTER_OPTIONS.map((opt) => (
              <MenuItem
                key={opt.value}
                selected={statusFilter === opt.value}
                onClick={() => {
                  setStatusFilter(opt.value);
                  setPage(0);
                  handleCloseStatusMenu();
                }}
              >
                {opt.label}
              </MenuItem>
            ))}
          </Menu>

          {!loading && filteredBills.length > 0 && (
            <TablePagination
              component="div"
              count={filteredBills.length}
              page={page}
              onPageChange={handleChangePage}
              rowsPerPage={rowsPerPage}
              onRowsPerPageChange={handleChangeRowsPerPage}
              rowsPerPageOptions={[5, 10, 25, 50]}
            />
          )}
        </Card>

        {/* Documents dialog: Inline viewer + tabs for Bill PDF and supporting docs */}
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
                  {documentTabs.map((tabItem, idx) => (
                    <Tab
                      key={`${tabItem.title}-${idx}`}
                      label={tabItem.label}
                      id={`doc-tab-${idx}`}
                      aria-controls={`doc-panel-${idx}`}
                    />
                  ))}
                </Tabs>

                <Box sx={{ flex: 1, minHeight: 480, display: 'flex', flexDirection: 'column' }}>
                  {!documentTabs[docViewTab]?.key ? (
                    <Typography variant="body2" color="text.secondary">
                      No document.
                    </Typography>
                  ) : (
                    <>
                      <Stack direction="row" alignItems="center" spacing={1} sx={{ mb: 1 }}>
                        <Button
                          size="small"
                          variant="outlined"
                          href={documentTabs[docViewTab]?.url}
                          target="_blank"
                          rel="noopener noreferrer"
                          startIcon={<Iconify icon="solar:download-minimalistic-bold" />}
                        >
                          {documentTabs[docViewTab]?.downloadLabel || 'Download document'}
                        </Button>
                      </Stack>
                      {previewLoading ? (
                        <Box sx={{ display: 'flex', alignItems: 'center', justifyContent: 'center', minHeight: 440 }}>
                          <CircularProgress />
                        </Box>
                      ) : previewBlobUrl ? (
                        <Box
                          component="iframe"
                          src={previewBlobUrl}
                          title={documentTabs[docViewTab]?.title || 'Document'}
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

        {/* Upload Application Form dialog */}
        <Dialog
          open={!!appFormDialogBill}
          onClose={() => { setAppFormDialogBill(null); setAppFormFile(null); }}
          maxWidth="sm"
          fullWidth
        >
          <DialogTitle>
            {appFormDialogBill?.applicationForm?.pdfUrl ? 'Replace Application Form' : 'Upload Application Form'}
          </DialogTitle>
          <DialogContent>
            <Typography variant="body2" color="text.secondary" sx={{ mb: 2 }}>
              Upload a Financial Assistance Application Form PDF for{' '}
              <strong>{appFormDialogBill?.patientName || 'this bill'}</strong>.
              The user will be notified via email and can fill it out using the online editor.
            </Typography>
            {appFormDialogBill?.applicationForm?.pdfUrl && (
              <Alert severity="info" sx={{ mb: 2 }}>
                This bill already has an application form. Uploading a new one will replace it and reset any user edits.
              </Alert>
            )}
            <Button
              variant="outlined"
              component="label"
              fullWidth
              sx={{ py: 2, borderStyle: 'dashed' }}
              startIcon={<Iconify icon="solar:upload-minimalistic-bold" />}
            >
              {appFormFile ? appFormFile.name : 'Choose PDF file'}
              <input
                type="file"
                hidden
                accept=".pdf,application/pdf"
                onChange={(e) => setAppFormFile(e.target.files?.[0] || null)}
              />
            </Button>
          </DialogContent>
          <DialogActions sx={{ px: 3, pb: 2 }}>
            <Button onClick={() => { setAppFormDialogBill(null); setAppFormFile(null); }}>Cancel</Button>
            <Button
              variant="contained"
              disabled={!appFormFile || uploadingAppForm}
              onClick={handleUploadAppForm}
              startIcon={uploadingAppForm ? <CircularProgress size={16} color="inherit" /> : null}
            >
              {uploadingAppForm ? 'Uploading...' : 'Upload & Notify User'}
            </Button>
          </DialogActions>
        </Dialog>

        {/* Request Changes dialog */}
        <Dialog
          open={!!requestChangesDialogBill}
          onClose={() => { setRequestChangesDialogBill(null); setRequestChangesNote(''); }}
          maxWidth="sm"
          fullWidth
        >
          <DialogTitle>Request Changes on Application</DialogTitle>
          <DialogContent>
            <Typography variant="body2" color="text.secondary" sx={{ mb: 2 }}>
              Request changes or additional information from the user for{' '}
              <strong>{requestChangesDialogBill?.patientName || 'this application'}</strong>.
              The user will receive an email with your note.
            </Typography>
            <TextField
              label="Note to user (optional)"
              multiline
              rows={4}
              fullWidth
              value={requestChangesNote}
              onChange={(e) => setRequestChangesNote(e.target.value)}
              placeholder="Please provide additional details about your income..."
              sx={{ mt: 1 }}
            />
          </DialogContent>
          <DialogActions sx={{ px: 3, pb: 2 }}>
            <Button onClick={() => { setRequestChangesDialogBill(null); setRequestChangesNote(''); }}>Cancel</Button>
            <Button
              variant="contained"
              color="warning"
              disabled={requestingChanges}
              onClick={handleRequestChanges}
              startIcon={requestingChanges ? <CircularProgress size={16} color="inherit" /> : null}
            >
              {requestingChanges ? 'Sending...' : 'Send Request & Notify User'}
            </Button>
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
