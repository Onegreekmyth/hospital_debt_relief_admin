import { useState, useEffect, useRef, useMemo } from 'react';

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
import Dialog from '@mui/material/Dialog';
import DialogTitle from '@mui/material/DialogTitle';
import DialogContent from '@mui/material/DialogContent';
import DialogActions from '@mui/material/DialogActions';
import TextField from '@mui/material/TextField';
import Typography from '@mui/material/Typography';
import Chip from '@mui/material/Chip';
import CircularProgress from '@mui/material/CircularProgress';
import Alert from '@mui/material/Alert';
import Divider from '@mui/material/Divider';
import Accordion from '@mui/material/Accordion';
import AccordionSummary from '@mui/material/AccordionSummary';
import AccordionDetails from '@mui/material/AccordionDetails';
import Tooltip from '@mui/material/Tooltip';
import Badge from '@mui/material/Badge';
import IconButton from '@mui/material/IconButton';
import Menu from '@mui/material/Menu';
import MenuItem from '@mui/material/MenuItem';
import Tabs from '@mui/material/Tabs';
import Tab from '@mui/material/Tab';

import { DashboardContent } from 'src/layouts/dashboard';
import { Iconify } from 'src/components/iconify';
import axios, { endpoints } from 'src/utils/axios';

// Document type value -> label (matches Hospital_Debt_Relief_Web BillInformationModal)
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

const getHipaaEmailConsentLabel = (value) => {
  if (value === 'unencrypted_consent') return 'Consent to unencrypted email';
  if (value === 'encrypted_required') return 'Require encrypted communication';
  return 'Not selected';
};

// ----------------------------------------------------------------------

export function PageOneView() {
  const [rows, setRows] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);
  const [openDialog, setOpenDialog] = useState(false);
  const [dialogMode, setDialogMode] = useState('view');
  const [currentRow, setCurrentRow] = useState(null);
  const [formValues, setFormValues] = useState({ name: '', email: '', phone: '', isVerified: false });
  const [eligibilityData, setEligibilityData] = useState([]);
  const [billsData, setBillsData] = useState([]);
  const [searchQuery, setSearchQuery] = useState('');
  const [page, setPage] = useState(0);
  const [rowsPerPage, setRowsPerPage] = useState(10);
  const [total, setTotal] = useState(0);
  const [verifiedFilter, setVerifiedFilter] = useState('all'); // 'all' | 'verified' | 'unverified'
  const [sortBy, setSortBy] = useState('createdAtDesc'); // createdAtDesc | createdAtAsc | nameAsc | nameDesc
  const [verifiedMenuAnchor, setVerifiedMenuAnchor] = useState(null);
  const [sortMenuAnchor, setSortMenuAnchor] = useState(null);
  const [billFiles, setBillFiles] = useState({});
  const [uploading, setUploading] = useState({});
  const [uploadSuccess, setUploadSuccess] = useState({});
  const [uploadError, setUploadError] = useState({});
  const [documentsBill, setDocumentsBill] = useState(null);
  const [docViewTab, setDocViewTab] = useState(0);
  const [previewBlobUrl, setPreviewBlobUrl] = useState(null);
  const [previewLoading, setPreviewLoading] = useState(false);
  const previewBlobUrlRef = useRef(null);
  const documentTabs = useMemo(() => {
    if (!documentsBill) return [];
    const tabs = [
      {
        label: documentsBill.pdfKey ? 'Bill PDF' : 'Bill PDF (none)',
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

  const isViewMode = dialogMode === 'view';

  // Fetch users from backend
  useEffect(() => {
    const fetchUsers = async () => {
      try {
        setLoading(true);
        setError(null);
        const response = await axios.get(endpoints.users.list, {
          params: {
            page: page + 1,
            limit: rowsPerPage,
            search: searchQuery,
            ...(verifiedFilter === 'verified' && { isVerified: 'true' }),
            ...(verifiedFilter === 'unverified' && { isVerified: 'false' }),
            sortBy,
          },
        });

        if (response.data.success) {
          setRows(response.data.data);
          setTotal(response.data.pagination.total);
        }
      } catch (err) {
        console.error('Error fetching users:', err);
        setError(err.response?.data?.message || 'Failed to fetch users');
      } finally {
        setLoading(false);
      }
    };

    // Debounce search
    const timeoutId = setTimeout(() => {
      fetchUsers();
    }, searchQuery ? 500 : 0);

    return () => clearTimeout(timeoutId);
  }, [page, rowsPerPage, searchQuery, verifiedFilter, sortBy]);

  // Load document preview (blob URL) for inline viewing when document viewer opens or tab changes
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

  const handleOpenDialog = (mode, row = null) => {
    setDialogMode(mode);
    setCurrentRow(row);
    if (row) {
      const displayName =
        [row.firstName, row.lastName].filter(Boolean).join(' ') || row.name || '';
      setFormValues({
        name: displayName,
        email: row.email || '',
        phone: row.phone || '',
        isVerified: row.isVerified || false,
      });
      // Set eligibility data and bills from the row
      setEligibilityData(row.eligibilityRequests || []);
      setBillsData(
        (row.bills || []).filter((bill) => (bill?.status || '').toLowerCase() !== 'inactive')
      );
    } else {
      setFormValues({ name: '', email: '', phone: '', isVerified: false });
      setEligibilityData([]);
      setBillsData([]);
    }
    setOpenDialog(true);
  };

  const handleCloseDialog = () => {
    setOpenDialog(false);
    setCurrentRow(null);
    setDocumentsBill(null);
  };

  const handleChangeField = (field) => (event) => {
    const value = event.target.type === 'checkbox' ? event.target.checked : event.target.value;
    setFormValues((prev) => ({
      ...prev,
      [field]: value,
    }));
  };

  const handleChangeSearch = (event) => {
    setSearchQuery(event.target.value);
    setPage(0);
  };

  const handleChangePage = (event, newPage) => {
    setPage(newPage);
  };

  const handleChangeRowsPerPage = (event) => {
    setRowsPerPage(parseInt(event.target.value, 10));
    setPage(0);
  };

  const openVerifiedMenu = (event) => {
    setVerifiedMenuAnchor(event.currentTarget);
  };

  const closeVerifiedMenu = () => {
    setVerifiedMenuAnchor(null);
  };

  const openSortMenu = (event) => {
    setSortMenuAnchor(event.currentTarget);
  };

  const closeSortMenu = () => {
    setSortMenuAnchor(null);
  };

  const formatDate = (dateString) => {
    if (!dateString) return 'N/A';
    return new Date(dateString).toLocaleDateString('en-US', {
      year: 'numeric',
      month: 'short',
      day: 'numeric',
    });
  };

  const getDisplayName = (row) =>
    [row?.firstName, row?.lastName].filter(Boolean).join(' ') || row?.name || 'N/A';

  const getActiveBillsCount = (row) => {
    const bills = row?.bills;
    if (!Array.isArray(bills)) return row?.billCount ?? 0;
    return bills.filter((bill) => (bill?.status || '').toLowerCase() !== 'inactive').length;
  };

  const handleBillFileChange = (userId, type) => async (event) => {
    const file = event.target.files?.[0];
    if (!file) {
      event.target.value = '';
      return;
    }

    if (file.type !== 'application/pdf') {
      setUploadError((prev) => ({
        ...prev,
        [`${userId}-${type}`]: 'Only PDF files are allowed',
      }));
      event.target.value = '';
      return;
    }

    // Check file size (10MB max)
    if (file.size > 10 * 1024 * 1024) {
      setUploadError((prev) => ({
        ...prev,
        [`${userId}-${type}`]: 'File size must be less than 10MB',
      }));
      event.target.value = '';
      return;
    }

    // Clear previous errors
    setUploadError((prev) => {
      const newError = { ...prev };
      delete newError[`${userId}-${type}`];
      return newError;
    });

    // Set uploading state
    setUploading((prev) => ({
      ...prev,
      [`${userId}-${type}`]: true,
    }));

    try {
      const formData = new FormData();
      formData.append('pdf', file);

      let response;
      if (type === 'billInfo' || type === 'billUpload') {
        // Upload as a new bill
        response = await axios.post(endpoints.users.uploadBill(userId), formData, {
          headers: {
            'Content-Type': 'multipart/form-data',
          },
        });
      } else {
        throw new Error('Unknown upload type');
      }

      if (response.data.success) {
        // Show success
        setUploadSuccess((prev) => ({
          ...prev,
          [`${userId}-${type}`]: true,
        }));

        // Clear success message after 3 seconds
        setTimeout(() => {
          setUploadSuccess((prev) => {
            const newSuccess = { ...prev };
            delete newSuccess[`${userId}-${type}`];
            return newSuccess;
          });
        }, 3000);

        // Refresh user list to show updated bill count
        const fetchResponse = await axios.get(endpoints.users.list, {
          params: {
            page: page + 1,
            limit: rowsPerPage,
            search: searchQuery,
          },
        });

        if (fetchResponse.data.success) {
          setRows(fetchResponse.data.data);
          setTotal(fetchResponse.data.pagination.total);
        }
      }
    } catch (err) {
      console.error('Error uploading file:', err);
      const message =
        err.response?.data?.message ||
        err.response?.data?.error ||
        err.message ||
        'Failed to upload file';
      setUploadError((prev) => ({
        ...prev,
        [`${userId}-${type}`]: message,
      }));
    } finally {
      setUploading((prev) => {
        const newUploading = { ...prev };
        delete newUploading[`${userId}-${type}`];
        return newUploading;
      });
      event.target.value = '';
    }
  };

  return (
    <DashboardContent maxWidth="xl">
      <Stack direction="row" alignItems="center" justifyContent="space-between" sx={{ mb: 3, flexWrap: 'wrap', gap: 2 }}>
        <Typography variant="h4">Users</Typography>

        <TextField
          size="small"
          placeholder="Search by name or email"
          value={searchQuery}
          onChange={handleChangeSearch}
          sx={{ minWidth: 240 }}
        />
      </Stack>

      {error && (
        <Alert severity="error" sx={{ mb: 3 }}>
          {error}
        </Alert>
      )}

      <Card>
        {loading ? (
          <Box sx={{ display: 'flex', justifyContent: 'center', p: 4 }}>
            <CircularProgress />
          </Box>
        ) : (
          <>
            <TableContainer>
              <Table>
                <TableHead>
                  <TableRow>
                    <TableCell>Name</TableCell>
                    <TableCell>Email</TableCell>
                    <TableCell>Phone</TableCell>
                    <TableCell>
                      <Stack direction="row" spacing={0.5} alignItems="center">
                        <Typography variant="inherit">Status</Typography>
                        <IconButton
                          size="small"
                          onClick={openVerifiedMenu}
                          color={verifiedFilter !== 'all' ? 'primary' : 'default'}
                          title="Filter status"
                          aria-label="Filter status"
                        >
                          <Iconify icon="solar:filter-bold" width={16} />
                        </IconButton>
                      </Stack>
                    </TableCell>
                    <TableCell>Eligibility Requests</TableCell>
                    <TableCell>Bills</TableCell>
                    <TableCell>
                      <Stack direction="row" spacing={0.5} alignItems="center">
                        <Typography variant="inherit">Created At</Typography>
                        <IconButton
                          size="small"
                          onClick={openSortMenu}
                          color={sortBy !== 'createdAtDesc' ? 'primary' : 'default'}
                          title="Sort users"
                          aria-label="Sort users"
                        >
                          <Iconify icon="solar:sort-bold" width={16} />
                        </IconButton>
                      </Stack>
                    </TableCell>
                    <TableCell align="right">Actions</TableCell>
                  </TableRow>
                </TableHead>
                <TableBody>
                  {rows.length === 0 ? (
                    <TableRow>
                      <TableCell colSpan={8} align="center" sx={{ py: 4 }}>
                        <Typography variant="body2" color="text.secondary">
                          No users found
                        </Typography>
                      </TableCell>
                    </TableRow>
                  ) : (
                    rows.map((row) => {
                      const userId = row._id;
                      const activeBillsCount = getActiveBillsCount(row);
                      const billInfoKey = `${userId}-billInfo`;
                      const billUploadKey = `${userId}-billUpload`;
                      const isUploadingBillInfo = uploading[billInfoKey];
                      const isUploadingBillUpload = uploading[billUploadKey];
                      const billInfoSuccess = uploadSuccess[billInfoKey];
                      const billUploadSuccess = uploadSuccess[billUploadKey];
                      const billInfoError = uploadError[billInfoKey];
                      const billUploadError = uploadError[billUploadKey];

                      return (
                      <TableRow key={row._id} hover>
                        <TableCell>{getDisplayName(row)}</TableCell>
                        <TableCell>{row.email || 'N/A'}</TableCell>
                        <TableCell>{row.phone || 'N/A'}</TableCell>
                        <TableCell>
                          <Chip
                            label={row.isVerified ? 'Verified' : 'Unverified'}
                            color={row.isVerified ? 'success' : 'default'}
                            size="small"
                          />
                        </TableCell>
                        <TableCell>
                          <Chip
                            label={row.eligibilityCount || 0}
                            color={row.eligibilityCount > 0 ? 'primary' : 'default'}
                            size="small"
                          />
                        </TableCell>
                        <TableCell>
                          <Chip
                            label={activeBillsCount}
                            color={activeBillsCount > 0 ? 'secondary' : 'default'}
                            size="small"
                          />
                        </TableCell>
                        <TableCell>{formatDate(row.createdAt)}</TableCell>
                        <TableCell align="right">
                          <Stack direction="row" spacing={1} justifyContent="flex-end" flexWrap="wrap">
                            <Button
                              size="small"
                              variant="outlined"
                              onClick={() => handleOpenDialog('view', row)}
                            >
                              View
                            </Button>

                            <Tooltip title={billInfoError || billInfoSuccess ? (billInfoSuccess ? 'Uploaded successfully!' : billInfoError) : 'Add Bill Information'}>
                              <Badge variant="dot" color="success" invisible={!billInfoSuccess}>
                                <Button
                                  component="label"
                                  size="small"
                                  variant="outlined"
                                  color={billInfoSuccess ? 'success' : billInfoError ? 'error' : 'primary'}
                                  sx={{ minWidth: 0, px: 1 }}
                                  aria-label="Add Bill Information"
                                  disabled={isUploadingBillInfo}
                                >
                                  {isUploadingBillInfo ? (
                                    <CircularProgress size={16} />
                                  ) : (
                                    <Iconify icon="solar:document-add-bold-duotone" />
                                  )}
                                  <input
                                    hidden
                                    type="file"
                                    accept="application/pdf"
                                    onChange={handleBillFileChange(row._id, 'billInfo')}
                                    disabled={isUploadingBillInfo}
                                  />
                                </Button>
                              </Badge>
                            </Tooltip>

                            <Tooltip title={billUploadError || billUploadSuccess ? (billUploadSuccess ? 'Uploaded successfully!' : billUploadError) : 'Upload bill'}>
                              <Badge variant="dot" color="success" invisible={!billUploadSuccess}>
                                <Button
                                  component="label"
                                  size="small"
                                  variant="outlined"
                                  color={billUploadSuccess ? 'success' : billUploadError ? 'error' : 'secondary'}
                                  sx={{ minWidth: 0, px: 1 }}
                                  aria-label="Upload bill"
                                  disabled={isUploadingBillUpload}
                                >
                                  {isUploadingBillUpload ? (
                                    <CircularProgress size={16} />
                                  ) : (
                                    <Iconify icon="solar:upload-bold-duotone" />
                                  )}
                                  <input
                                    hidden
                                    type="file"
                                    accept="application/pdf"
                                    onChange={handleBillFileChange(row._id, 'billUpload')}
                                    disabled={isUploadingBillUpload}
                                  />
                                </Button>
                              </Badge>
                            </Tooltip>
                          </Stack>
                        </TableCell>
                      </TableRow>
                    );
                    })
                  )}
                </TableBody>
              </Table>
            </TableContainer>

            <TablePagination
              component="div"
              count={total}
              page={page}
              onPageChange={handleChangePage}
              rowsPerPage={rowsPerPage}
              onRowsPerPageChange={handleChangeRowsPerPage}
              rowsPerPageOptions={[5, 10, 25, 50]}
            />
          </>
        )}
      </Card>

      <Menu
        anchorEl={verifiedMenuAnchor}
        open={Boolean(verifiedMenuAnchor)}
        onClose={closeVerifiedMenu}
        anchorOrigin={{ vertical: 'bottom', horizontal: 'left' }}
        transformOrigin={{ vertical: 'top', horizontal: 'left' }}
      >
        <MenuItem
          selected={verifiedFilter === 'all'}
          onClick={() => {
            setVerifiedFilter('all');
            setPage(0);
            closeVerifiedMenu();
          }}
        >
          All users
        </MenuItem>
        <MenuItem
          selected={verifiedFilter === 'verified'}
          onClick={() => {
            setVerifiedFilter('verified');
            setPage(0);
            closeVerifiedMenu();
          }}
        >
          Verified only
        </MenuItem>
        <MenuItem
          selected={verifiedFilter === 'unverified'}
          onClick={() => {
            setVerifiedFilter('unverified');
            setPage(0);
            closeVerifiedMenu();
          }}
        >
          Unverified only
        </MenuItem>
      </Menu>

      <Menu
        anchorEl={sortMenuAnchor}
        open={Boolean(sortMenuAnchor)}
        onClose={closeSortMenu}
        anchorOrigin={{ vertical: 'bottom', horizontal: 'left' }}
        transformOrigin={{ vertical: 'top', horizontal: 'left' }}
      >
        <MenuItem
          selected={sortBy === 'createdAtDesc'}
          onClick={() => {
            setSortBy('createdAtDesc');
            setPage(0);
            closeSortMenu();
          }}
        >
          Newest first
        </MenuItem>
        <MenuItem
          selected={sortBy === 'createdAtAsc'}
          onClick={() => {
            setSortBy('createdAtAsc');
            setPage(0);
            closeSortMenu();
          }}
        >
          Oldest first
        </MenuItem>
        <MenuItem
          selected={sortBy === 'nameAsc'}
          onClick={() => {
            setSortBy('nameAsc');
            setPage(0);
            closeSortMenu();
          }}
        >
          Name (A-Z)
        </MenuItem>
        <MenuItem
          selected={sortBy === 'nameDesc'}
          onClick={() => {
            setSortBy('nameDesc');
            setPage(0);
            closeSortMenu();
          }}
        >
          Name (Z-A)
        </MenuItem>
      </Menu>

      <Dialog
        open={openDialog}
        onClose={handleCloseDialog}
        fullWidth
        maxWidth="md"
      >
        <DialogTitle>View User</DialogTitle>

        <DialogContent dividers>
          <Box sx={{ mt: 1 }}>
            <Typography variant="h6" sx={{ mb: 2 }}>
              User Information
            </Typography>
            <Box
              sx={{
                display: 'grid',
                gridTemplateColumns: { xs: '1fr', sm: '1fr 1fr' },
                gap: 2,
              }}
            >
              <TextField
                label="Name"
                size="small"
                value={formValues.name}
                onChange={handleChangeField('name')}
                InputProps={{ readOnly: isViewMode }}
                fullWidth
              />

              <TextField
                label="Email"
                size="small"
                type="email"
                value={formValues.email}
                onChange={handleChangeField('email')}
                InputProps={{ readOnly: isViewMode }}
                fullWidth
              />

              <TextField
                label="Phone"
                size="small"
                value={formValues.phone}
                onChange={handleChangeField('phone')}
                InputProps={{ readOnly: isViewMode }}
                fullWidth
              />

              <Box sx={{ display: 'flex', alignItems: 'center' }}>
                <Chip
                  label={formValues.isVerified ? 'Verified' : 'Unverified'}
                  color={formValues.isVerified ? 'success' : 'default'}
                  size="small"
                />
              </Box>
            </Box>

            <Divider sx={{ my: 3 }} />

            <Typography variant="h6" sx={{ mb: 2 }}>
              Eligibility Requests ({eligibilityData.length})
            </Typography>

            {eligibilityData.length === 0 ? (
              <Typography variant="body2" color="text.secondary" sx={{ py: 2 }}>
                No eligibility requests found for this user.
              </Typography>
            ) : (
              <Stack spacing={2}>
                {eligibilityData.map((eligibility, index) => (
                  <Accordion key={eligibility._id || index}>
                    <AccordionSummary expandIcon={<Iconify icon="eva:arrow-ios-downward-fill" />}>
                      <Stack direction="row" spacing={2} alignItems="center" sx={{ width: '100%' }}>
                        <Typography variant="subtitle2" sx={{ flex: 1 }}>
                          {eligibility.hospitalName || 'Unknown Hospital'}
                        </Typography>
                        <Chip
                          label={eligibility.eligible ? 'Eligible' : 'Not Eligible'}
                          color={eligibility.eligible ? 'success' : 'default'}
                          size="small"
                        />
                        <Chip
                          label={eligibility.eligibilityType?.replace('_', ' ') || 'N/A'}
                          size="small"
                          variant="outlined"
                        />
                      </Stack>
                    </AccordionSummary>
                    <AccordionDetails>
                      <Box
                        sx={{
                          display: 'grid',
                          gridTemplateColumns: { xs: '1fr', sm: '1fr 1fr' },
                          gap: 2,
                        }}
                      >
                        <Box>
                          <Typography variant="caption" color="text.secondary">
                            Hospital
                          </Typography>
                          <Typography variant="body2">{eligibility.hospitalName || 'N/A'}</Typography>
                        </Box>
                        <Box>
                          <Typography variant="caption" color="text.secondary">
                            Location
                          </Typography>
                          <Typography variant="body2">
                            {eligibility.city || 'N/A'}, {eligibility.state || 'N/A'}
                          </Typography>
                        </Box>
                        <Box>
                          <Typography variant="caption" color="text.secondary">
                            Household Income
                          </Typography>
                          <Typography variant="body2">
                            ${eligibility.householdIncome?.toLocaleString() || 'N/A'}
                          </Typography>
                        </Box>
                        <Box>
                          <Typography variant="caption" color="text.secondary">
                            Household Size
                          </Typography>
                          <Typography variant="body2">{eligibility.householdSize || 'N/A'}</Typography>
                        </Box>
                        {eligibility.billAmount && (
                          <Box>
                            <Typography variant="caption" color="text.secondary">
                              Bill Amount
                            </Typography>
                            <Typography variant="body2">
                              ${eligibility.billAmount.toLocaleString()}
                            </Typography>
                          </Box>
                        )}
                        <Box>
                          <Typography variant="caption" color="text.secondary">
                            FPL Percentage
                          </Typography>
                          <Typography variant="body2">
                            {eligibility.fplPercentage?.toFixed(1) || 'N/A'}%
                          </Typography>
                        </Box>
                        {eligibility.estimatedDiscount > 0 && (
                          <Box>
                            <Typography variant="caption" color="text.secondary">
                              Estimated Discount
                            </Typography>
                            <Typography variant="body2" color="success.main">
                              ${eligibility.estimatedDiscount.toLocaleString()}
                            </Typography>
                          </Box>
                        )}
                        <Box>
                          <Typography variant="caption" color="text.secondary">
                            Request Date
                          </Typography>
                          <Typography variant="body2">
                            {formatDate(eligibility.createdAt)}
                          </Typography>
                        </Box>
                      </Box>
                    </AccordionDetails>
                  </Accordion>
                ))}
              </Stack>
            )}

            <Divider sx={{ my: 3 }} />

            <Typography variant="h6" sx={{ mb: 2 }}>
              Bills ({billsData.length})
            </Typography>

            {billsData.length === 0 ? (
              <Typography variant="body2" color="text.secondary" sx={{ py: 2 }}>
                No bills found for this user.
              </Typography>
            ) : (
              <Stack spacing={2}>
                {billsData.map((bill, index) => (
                  <Accordion key={bill._id || index}>
                    <AccordionSummary expandIcon={<Iconify icon="eva:arrow-ios-downward-fill" />}>
                      <Stack direction="row" spacing={2} alignItems="center" sx={{ width: '100%' }} flexWrap="wrap">
                        <Typography variant="subtitle2" sx={{ flex: 1, minWidth: 120 }}>
                          {bill.patientName || 'Unknown Patient'}
                        </Typography>
                        {bill.documentType && (
                          <Chip
                            label={getDocumentTypeLabel(bill.documentType)}
                            size="small"
                            variant="outlined"
                          />
                        )}
                        <Chip
                          label={`$${bill.billAmount?.toLocaleString() || '0'}`}
                          color="primary"
                          size="small"
                        />
                        <Chip
                          label={bill.status || 'pending'}
                          color={
                            bill.status === 'approved'
                              ? 'success'
                              : bill.status === 'rejected'
                              ? 'error'
                              : bill.status === 'submitted' || bill.status === 'processing'
                              ? 'info'
                              : 'default'
                          }
                          size="small"
                          variant="outlined"
                        />
                      </Stack>
                    </AccordionSummary>
                    <AccordionDetails>
                      <Box
                        sx={{
                          display: 'grid',
                          gridTemplateColumns: { xs: '1fr', sm: '1fr 1fr' },
                          gap: 2,
                        }}
                      >
                        <Box>
                          <Typography variant="caption" color="text.secondary">
                            Patient Name
                          </Typography>
                          <Typography variant="body2">{bill.patientName || 'N/A'}</Typography>
                        </Box>
                        <Box>
                          <Typography variant="caption" color="text.secondary">
                            Type
                          </Typography>
                          <Typography variant="body2">
                            {getDocumentTypeLabel(bill.documentType)}
                          </Typography>
                        </Box>
                        <Box>
                          <Typography variant="caption" color="text.secondary">
                            Bill Amount
                          </Typography>
                          <Typography variant="body2">
                            ${bill.billAmount?.toLocaleString() || 'N/A'}
                          </Typography>
                        </Box>
                        <Box>
                          <Typography variant="caption" color="text.secondary">
                            Service Date
                          </Typography>
                          <Typography variant="body2">
                            {bill.serviceDate ? formatDate(bill.serviceDate) : 'N/A'}
                          </Typography>
                        </Box>
                        <Box>
                          <Typography variant="caption" color="text.secondary">
                            Status
                          </Typography>
                          <Typography variant="body2">{bill.status || 'N/A'}</Typography>
                        </Box>
                        <Box sx={{ gridColumn: '1 / -1' }}>
                          <Typography variant="caption" color="text.secondary">
                            HIPAA Email Communication Preference
                          </Typography>
                          <Typography variant="body2">
                            {getHipaaEmailConsentLabel(bill.hipaaEmailConsent)}
                          </Typography>
                        </Box>
                        <Box>
                          <Typography variant="caption" color="text.secondary">
                            Submitted At
                          </Typography>
                          <Typography variant="body2">
                            {bill.submittedAt ? formatDate(bill.submittedAt) : formatDate(bill.createdAt)}
                          </Typography>
                        </Box>
                        {(bill.pdfUrl || bill.pdfKey) && (
                          <Box>
                            <Typography variant="caption" color="text.secondary">
                              Bill PDF
                            </Typography>
                            <Stack direction="row" spacing={1} flexWrap="wrap">
                              {bill.pdfKey && (
                                <Button
                                  size="small"
                                  variant="outlined"
                                  startIcon={<Iconify icon="solar:document-bold-duotone" />}
                                  onClick={() => {
                                    setDocumentsBill(bill);
                                    setDocViewTab(0);
                                  }}
                                >
                                  View in dashboard
                                </Button>
                              )}
                              {bill.pdfUrl && (
                                <Button
                                  size="small"
                                  variant="outlined"
                                  href={bill.pdfUrl}
                                  target="_blank"
                                  rel="noopener noreferrer"
                                  startIcon={<Iconify icon="solar:download-minimalistic-bold" />}
                                >
                                  Download
                                </Button>
                              )}
                            </Stack>
                          </Box>
                        )}
                        {bill.supportingDocuments && bill.supportingDocuments.length > 0 && (
                          <Box sx={{ gridColumn: '1 / -1' }}>
                            <Typography variant="caption" color="text.secondary" sx={{ display: 'block', mb: 1 }}>
                              Supporting Documents ({bill.supportingDocuments.length})
                            </Typography>
                            <Stack direction="row" spacing={1} flexWrap="wrap" useFlexGap>
                              {bill.supportingDocuments.map((doc, docIndex) => {
                                const typeLabel = doc.documentType
                                  ? (DOCUMENT_TYPE_LABELS[doc.documentType] || doc.documentType)
                                  : null;
                                return (
                                  <Box key={docIndex} sx={{ display: 'flex', flexDirection: 'column', alignItems: 'flex-start', gap: 0.25 }}>
                                    <Stack direction="row" spacing={1} alignItems="center" flexWrap="wrap">
                                      {doc.pdfKey && (
                                        <Button
                                          size="small"
                                          variant="outlined"
                                          startIcon={<Iconify icon="solar:document-bold-duotone" />}
                                          onClick={() => {
                                            setDocumentsBill(bill);
                                            setDocViewTab(docIndex + 1);
                                          }}
                                        >
                                          View in dashboard
                                        </Button>
                                      )}
                                      {doc.pdfUrl && (
                                        <Button
                                          size="small"
                                          variant="outlined"
                                          href={doc.pdfUrl}
                                          target="_blank"
                                          rel="noopener noreferrer"
                                          startIcon={<Iconify icon="solar:download-minimalistic-bold" />}
                                        >
                                          Download
                                        </Button>
                                      )}
                                    </Stack>
                                    {typeLabel && (
                                      <Typography variant="caption" color="text.secondary">
                                        Type: {typeLabel}
                                      </Typography>
                                    )}
                                  </Box>
                                );
                              })}
                            </Stack>
                          </Box>
                        )}
                      </Box>
                    </AccordionDetails>
                  </Accordion>
                ))}
              </Stack>
            )}
          </Box>
        </DialogContent>

        <DialogActions>
          <Button onClick={handleCloseDialog}>Close</Button>
        </DialogActions>
      </Dialog>

      {/* Document viewer: view bill PDF and supporting docs inline (same as Bill Approval) */}
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
                    id={`user-doc-tab-${idx + 1}`}
                    aria-controls={`user-doc-panel-${idx + 1}`}
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
    </DashboardContent>
  );
}


