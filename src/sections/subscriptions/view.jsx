import { useState, useEffect } from 'react';

import Box from '@mui/material/Box';
import Card from '@mui/material/Card';
import Stack from '@mui/material/Stack';
import Tabs from '@mui/material/Tabs';
import Tab from '@mui/material/Tab';
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
import TextField from '@mui/material/TextField';

import { DashboardContent } from 'src/layouts/dashboard';
import axios, { endpoints } from 'src/utils/axios';

// ----------------------------------------------------------------------

const TAB_CONFIG = [
  { value: 'active', label: 'Active subscriptions' },
  { value: 'cancelled', label: 'Cancelled subscriptions' },
  { value: 'all', label: 'All users' },
];

// ----------------------------------------------------------------------

export function SubscriptionsView() {
  const [tab, setTab] = useState('active');
  const [rows, setRows] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);
  const [page, setPage] = useState(0);
  const [rowsPerPage, setRowsPerPage] = useState(10);
  const [total, setTotal] = useState(0);
  const [searchQuery, setSearchQuery] = useState('');

  useEffect(() => {
    const fetchData = async () => {
      try {
        setLoading(true);
        setError(null);
        const res = await axios.get(endpoints.subscriptions.list, {
          params: {
            page: page + 1,
            limit: rowsPerPage,
            subscriptionStatus: tab,
            search: searchQuery,
          },
        });
        if (res.data?.success) {
          const allRows = res.data.data || [];
          // Extra safety: filter on FE so each tab only shows matching status,
          // even if the backend ignores subscriptionStatus.
          const filtered =
            tab === 'all'
              ? allRows
              : allRows.filter((user) => {
                  const status = user?.subscription?.status;
                  if (tab === 'active') return status === 'active';
                  if (tab === 'cancelled') return status === 'cancelled';
                  return true;
                });
          const safetySearch = searchQuery?.trim().toLowerCase();
          setRows(
            safetySearch
              ? filtered.filter((user) => {
                  const name = [user?.firstName, user?.lastName].filter(Boolean).join(' ').toLowerCase();
                  const email = (user?.email || '').toLowerCase();
                  const planId = (user?.subscription?.planId || '').toLowerCase();
                  return name.includes(safetySearch) || email.includes(safetySearch) || planId.includes(safetySearch);
                })
              : filtered
          );
          setTotal(res.data.pagination?.total ?? filtered.length);
        }
      } catch (err) {
        // eslint-disable-next-line no-console
        console.error('Error fetching subscriptions:', err);
        const msg =
          err?.error ||
          err?.message ||
          err?.response?.data?.message ||
          'Failed to load subscriptions';
        setError(msg);
      } finally {
        setLoading(false);
      }
    };
    fetchData();
  }, [tab, page, rowsPerPage, searchQuery]);

  const handleChangeTab = (event, value) => {
    setTab(value);
    setPage(0);
  };

  const handleChangePage = (event, newPage) => {
    setPage(newPage);
  };

  const handleChangeRowsPerPage = (event) => {
    setRowsPerPage(parseInt(event.target.value, 10));
    setPage(0);
  };

  const formatDateTime = (value) => {
    if (!value) return '—';
    return new Date(value).toLocaleString('en-US', {
      year: 'numeric',
      month: 'short',
      day: 'numeric',
      hour: '2-digit',
      minute: '2-digit',
    });
  };

  const formatPlanLabel = (user) => {
    const planId = user?.subscription?.planId;
    if (!planId) return '—';
    if (planId === 'monthly_basic') return 'Monthly Basic';
    if (planId === 'monthly_standard') return 'Monthly Standard';
    if (planId === 'monthly_premium') return 'Monthly Premium';
    if (planId === 'one_time_flat') return 'One-time Flat';
    return planId;
  };

  const formatStatusLabel = (user) => {
    const status = user?.subscription?.status || 'inactive';
    if (status === 'active') return 'Active';
    if (status === 'cancelled') return 'Cancelled';
    if (status === 'expired') return 'Expired';
    if (status === 'past_due') return 'Past due';
    return 'Inactive';
  };

  const getStatusColor = (user) => {
    const status = user?.subscription?.status || 'inactive';
    if (status === 'active') return 'success';
    if (status === 'cancelled') return 'default';
    if (status === 'expired') return 'warning';
    if (status === 'past_due') return 'error';
    return 'default';
  };

  const getDisplayName = (user) =>
    [user?.firstName, user?.lastName].filter(Boolean).join(' ') || user?.name || 'N/A';

  return (
    <DashboardContent maxWidth="xl">
      <Stack spacing={3}>
        <Stack direction="row" alignItems="center" justifyContent="space-between">
          <Typography variant="h4">Subscriptions</Typography>
        </Stack>

        <Card>
          <Stack direction="row" alignItems="center" justifyContent="space-between" sx={{ px: 2, pt: 2, gap: 2, flexWrap: 'wrap' }}>
          <Tabs
            value={tab}
            onChange={handleChangeTab}
            sx={{ px: 2, pt: 1 }}
            aria-label="Subscription status tabs"
          >
            {TAB_CONFIG.map((item) => (
              <Tab key={item.value} label={item.label} value={item.value} />
            ))}
          </Tabs>
          <TextField
            size="small"
            value={searchQuery}
            onChange={(e) => {
              setSearchQuery(e.target.value);
              setPage(0);
            }}
            placeholder="Search by name, email, or plan"
            sx={{ minWidth: 280 }}
          />
          </Stack>

          {error && (
            <Alert severity="error" sx={{ mx: 2, mt: 2 }}>
              {error}
            </Alert>
          )}

          {loading ? (
            <Box sx={{ display: 'flex', justifyContent: 'center', py: 6 }}>
              <CircularProgress />
            </Box>
          ) : (
            <>
              <TableContainer>
                <Table>
                  <TableHead>
                    <TableRow>
                      <TableCell>User</TableCell>
                      <TableCell>Email</TableCell>
                      <TableCell>Plan</TableCell>
                      <TableCell>Status</TableCell>
                      <TableCell>Current period</TableCell>
                      <TableCell>Cancel at period end</TableCell>
                      <TableCell>Created</TableCell>
                    </TableRow>
                  </TableHead>
                  <TableBody>
                    {rows.length === 0 ? (
                      <TableRow>
                        <TableCell colSpan={7} align="center" sx={{ py: 4 }}>
                          <Typography variant="body2" color="text.secondary">
                            No users found for this filter.
                          </Typography>
                        </TableCell>
                      </TableRow>
                    ) : (
                      rows.map((user) => {
                        const sub = user.subscription || {};
                        return (
                          <TableRow key={user._id} hover>
                            <TableCell>{getDisplayName(user)}</TableCell>
                            <TableCell>{user.email || 'N/A'}</TableCell>
                            <TableCell>{formatPlanLabel(user)}</TableCell>
                            <TableCell>
                              <Chip
                                size="small"
                                label={formatStatusLabel(user)}
                                color={getStatusColor(user)}
                              />
                            </TableCell>
                            <TableCell>
                              <Stack spacing={0.5}>
                                <Typography variant="caption" color="text.secondary">
                                  Start
                                </Typography>
                                <Typography variant="body2">
                                  {formatDateTime(sub.currentPeriodStart)}
                                </Typography>
                                <Typography variant="caption" color="text.secondary">
                                  End
                                </Typography>
                                <Typography variant="body2">
                                  {formatDateTime(sub.currentPeriodEnd)}
                                </Typography>
                              </Stack>
                            </TableCell>
                            <TableCell>
                              <Chip
                                size="small"
                                label={sub.cancelAtPeriodEnd ? 'Yes' : 'No'}
                                color={sub.cancelAtPeriodEnd ? 'warning' : 'default'}
                              />
                            </TableCell>
                            <TableCell>{formatDateTime(user.createdAt)}</TableCell>
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
      </Stack>
    </DashboardContent>
  );
}

