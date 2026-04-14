import { useState, useEffect, useCallback } from 'react';
import { useNavigate } from 'react-router-dom';

/* eslint-disable import/no-unresolved */
import {
  ResponsiveContainer,
  BarChart,
  Bar,
  XAxis,
  YAxis,
  Tooltip,
  LineChart,
  Line,
  PieChart,
  Pie,
  Cell,
  Legend,
} from 'recharts';
/* eslint-enable import/no-unresolved */

import Box from '@mui/material/Box';
import Card from '@mui/material/Card';
import Stack from '@mui/material/Stack';
import Typography from '@mui/material/Typography';
import Grid from '@mui/material/Grid';
import Skeleton from '@mui/material/Skeleton';
import Divider from '@mui/material/Divider';
import { useTheme } from '@mui/material/styles';

import { DashboardContent } from 'src/layouts/dashboard';
import { Iconify } from 'src/components/iconify';
import axios, { endpoints } from 'src/utils/axios';

// Derive subscription counts from user profile subscription.status
function getSubscriptionCounts(users) {
  let active = 0;
  let cancelled = 0;
  if (!Array.isArray(users)) return { activeSubscriptions: 0, cancelledSubscriptions: 0 };
  users.forEach((u) => {
    const status = (u.subscription?.status || '').toLowerCase();
    if (status === 'active') active += 1;
    else if (status === 'cancelled' || status === 'canceled') cancelled += 1;
  });
  return { activeSubscriptions: active, cancelledSubscriptions: cancelled };
}

// Flatten all bills from users (same as Bill Approval page) and count by status
function getBillCounts(users) {
  let total = 0;
  let pending = 0;
  let approved = 0;
  let incomplete = 0;
  if (!Array.isArray(users)) {
    return { totalBills: 0, pendingBills: 0, approvedBills: 0, incompleteBills: 0 };
  }
  users.forEach((user) => {
    (user.bills || []).forEach((bill) => {
      total += 1;
      const status = (bill.status || '').toLowerCase();
      if (status === 'pending') pending += 1;
      else if (status === 'approved') approved += 1;
      else if (status === 'inactive') incomplete += 1;
    });
  });
  return {
    totalBills: total,
    pendingBills: pending,
    approvedBills: approved,
    incompleteBills: incomplete,
  };
}

// ----------------------------------------------------------------------

const DEFAULT_STATS = {
  activeSubscriptions: 0,
  cancelledSubscriptions: 0,
  totalRevenue: 0,
  totalUsers: 0,
  totalBills: 0,
  pendingBills: 0,
  approvedBills: 0,
  incompleteBills: 0,
  refundRequestCount: 0,
  flatFeePaidBills: 0,
  newUsersLast30Days: 0,
  eligibilityRequestsCount: 0,
};

const PALETTE_KEYS_WITH_MAIN = ['primary', 'secondary', 'success', 'warning', 'error', 'info'];

function StatCard({ title, value, icon, color = 'primary', onClick }) {
  const isRevenue = title.toLowerCase().includes('revenue');
  const displayValue =
    isRevenue && typeof value === 'number'
      ? value >= 1000
        ? `$${(value / 1000).toFixed(1)}k`
        : `$${value.toLocaleString()}`
      : value;
  const useGrey = !PALETTE_KEYS_WITH_MAIN.includes(color);

  return (
    <Card
      sx={{
        p: 2.5,
        height: '100%',
        display: 'flex',
        flexDirection: 'column',
        justifyContent: 'space-between',
        cursor: onClick ? 'pointer' : 'default',
        transition: 'box-shadow 0.2s',
        boxShadow: onClick ? 4 : undefined,
        '&:hover': onClick ? { boxShadow: 8, bgcolor: 'action.hover' } : {},
      }}
      onClick={onClick}
      tabIndex={onClick ? 0 : undefined}
      role={onClick ? 'button' : undefined}
    >
      <Stack direction="row" alignItems="center" justifyContent="space-between" sx={{ mb: 1 }}>
        <Typography variant="subtitle2" color="text.secondary">
          {title}
        </Typography>
        {icon && (
          <Box
            sx={{
              width: 48,
              height: 48,
              borderRadius: 2,
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              ...(useGrey
                ? {
                    bgcolor: (theme) => `${theme.vars.palette.grey['500Channel']}20`,
                    color: 'grey.600',
                  }
                : {
                    bgcolor: (theme) => `${theme.vars.palette[color].mainChannel}20`,
                    color: `${color}.main`,
                  }),
            }}
          >
            <Iconify icon={icon} width={28} />
          </Box>
        )}
      </Stack>
      <Typography variant="h4">{displayValue}</Typography>
    </Card>
  );
}

// ----------------------------------------------------------------------

export function OverviewView() {
  const navigate = useNavigate();

  // Navigation handlers for each tile
  const handleTileClick = (type) => {
    switch (type) {
      case 'Active subscriptions':
        navigate('/dashboard/subscriptions?status=active');
        break;
      case 'Cancelled subscriptions':
        navigate('/dashboard/subscriptions?status=cancelled');
        break;
      case 'Total users':
        navigate('/dashboard/users');
        break;
      case 'Total bills':
        navigate('/dashboard/bill-approval');
        break;
      case 'Pending bills':
        navigate('/dashboard/bill-approval?status=pending');
        break;
      case 'Approved bills':
        navigate('/dashboard/bill-approval?status=approved');
        break;
      case 'Incomplete bills':
        navigate('/dashboard/bill-approval?status=incomplete');
        break;
      case 'Refund requests':
        navigate('/dashboard/refund-requests');
        break;
      case 'Flat-fee bills paid':
        navigate('/dashboard/bill-approval?type=flat-fee');
        break;
      case 'New users (30 days)':
        navigate('/dashboard/users?recent=30');
        break;
      case 'Eligibility checks':
        navigate('/dashboard/eligibility');
        break;
      default:
        break;
    }
  };
  const theme = useTheme();
  const [stats, setStats] = useState(DEFAULT_STATS);
  const [loading, setLoading] = useState(true);
  const [charts, setCharts] = useState({
    billsByStatus: [],
    monthlyFlatFeeRevenue: [],
    eligibilityByType: [],
    subscriptionsByPlan: [],
  });

  const fetchStats = useCallback(async () => {
    try {
      setLoading(true);
      let nextStats = { ...DEFAULT_STATS };

      try {
        const res = await axios.get(endpoints.analytics.stats);
        if (res.data?.success && res.data?.data) {
          const { totals, charts: chartPayload } = res.data.data;
          if (totals) {
            nextStats = { ...DEFAULT_STATS, ...totals };
          }
          if (chartPayload) {
            setCharts({
              billsByStatus: chartPayload.billsByStatus || [],
              monthlyFlatFeeRevenue: chartPayload.monthlyFlatFeeRevenue || [],
              eligibilityByType: chartPayload.eligibilityByType || [],
              subscriptionsByPlan: chartPayload.subscriptionsByPlan || [],
            });
          }
        }
      } catch (err) {
        // Analytics API optional; we fill from users list below
      }

      // Get total users, active/cancelled subscriptions from users list (user profile)
      try {
        const usersRes = await axios.get(endpoints.users.list, {
          params: { page: 1, limit: 500 },
        });
        const users = usersRes.data?.data || [];
        const total = usersRes.data?.pagination?.total;
        if (typeof total === 'number') nextStats.totalUsers = total;
        else if (Array.isArray(users)) nextStats.totalUsers = users.length;
        const { activeSubscriptions, cancelledSubscriptions } = getSubscriptionCounts(users);
        nextStats.activeSubscriptions = activeSubscriptions;
        nextStats.cancelledSubscriptions = cancelledSubscriptions;
        const { totalBills, pendingBills, approvedBills, incompleteBills } = getBillCounts(users);
        nextStats.totalBills = totalBills;
        nextStats.pendingBills = pendingBills;
        nextStats.approvedBills = approvedBills;
        nextStats.incompleteBills = incompleteBills;
      } catch (e) {
        // keep existing nextStats
      }

      // Refund request count (same as Refund Requests page)
      try {
        const refundRes = await axios.get(endpoints.refundRequests.list);
        if (refundRes.data?.success && Array.isArray(refundRes.data?.data)) {
          nextStats.refundRequestCount = refundRes.data.data.length;
        }
      } catch (e) {
        // keep 0
      }

      setStats(nextStats);
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    fetchStats();
  }, [fetchStats]);

  return (
    <DashboardContent maxWidth="xl">
      <Stack spacing={3}>
        <Typography variant="h4">Dashboard</Typography>

        <Grid container spacing={3}>
          <Grid item xs={12} sm={6} md={4} lg={3}>
            {loading ? (
              <Skeleton variant="rounded" height={120} />
            ) : (
              <StatCard
                title="Active subscriptions"
                value={stats.activeSubscriptions}
                icon="solar:users-group-rounded-bold-duotone"
                color="success"
                onClick={() => handleTileClick('Active subscriptions')}
              />
            )}
          </Grid>
          <Grid item xs={12} sm={6} md={4} lg={3}>
            {loading ? (
              <Skeleton variant="rounded" height={120} />
            ) : (
              <StatCard
                title="Cancelled subscriptions"
                value={stats.cancelledSubscriptions}
                icon="solar:user-minus-rounded-bold-duotone"
                color="error"
                onClick={() => handleTileClick('Cancelled subscriptions')}
              />
            )}
          </Grid>
          <Grid item xs={12} sm={6} md={4} lg={3}>
            {loading ? (
              <Skeleton variant="rounded" height={120} />
            ) : (
              <StatCard
                title="Total revenue"
                value={stats.totalRevenue}
                icon="solar:wallet-money-bold-duotone"
                color="info"
                // No navigation for revenue
              />
            )}
          </Grid>
          <Grid item xs={12} sm={6} md={4} lg={3}>
            {loading ? (
              <Skeleton variant="rounded" height={120} />
            ) : (
              <StatCard
                title="Total users"
                value={stats.totalUsers}
                icon="solar:users-group-rounded-bold-duotone"
                color="primary"
                onClick={() => handleTileClick('Total users')}
              />
            )}
          </Grid>
          <Grid item xs={12} sm={6} md={4} lg={3}>
            {loading ? (
              <Skeleton variant="rounded" height={120} />
            ) : (
              <StatCard
                title="Total bills"
                value={stats.totalBills}
                icon="solar:document-text-bold-duotone"
                color="secondary"
                onClick={() => handleTileClick('Total bills')}
              />
            )}
          </Grid>
          <Grid item xs={12} sm={6} md={4} lg={3}>
            {loading ? (
              <Skeleton variant="rounded" height={120} />
            ) : (
              <StatCard
                title="Pending bills"
                value={stats.pendingBills}
                icon="solar:clock-circle-bold-duotone"
                color="warning"
                onClick={() => handleTileClick('Pending bills')}
              />
            )}
          </Grid>
          <Grid item xs={12} sm={6} md={4} lg={3}>
            {loading ? (
              <Skeleton variant="rounded" height={120} />
            ) : (
              <StatCard
                title="Approved bills"
                value={stats.approvedBills}
                icon="solar:check-circle-bold-duotone"
                color="success"
                onClick={() => handleTileClick('Approved bills')}
              />
            )}
          </Grid>
          <Grid item xs={12} sm={6} md={4} lg={3}>
            {loading ? (
              <Skeleton variant="rounded" height={120} />
            ) : (
              <StatCard
                title="Incomplete bills"
                value={stats.incompleteBills}
                icon="solar:document-text-bold-duotone"
                color="default"
                onClick={() => handleTileClick('Incomplete bills')}
              />
            )}
          </Grid>
          <Grid item xs={12} sm={6} md={4} lg={3}>
            {loading ? (
              <Skeleton variant="rounded" height={120} />
            ) : (
              <StatCard
                title="Refund requests"
                value={stats.refundRequestCount}
                icon="solar:refresh-bold-duotone"
                color="warning"
                onClick={() => handleTileClick('Refund requests')}
              />
            )}
          </Grid>
          <Grid item xs={12} sm={6} md={4} lg={3}>
            {loading ? (
              <Skeleton variant="rounded" height={120} />
            ) : (
              <StatCard
                title="Flat-fee bills paid"
                value={stats.flatFeePaidBills}
                icon="solar:card-bold-duotone"
                color="info"
                onClick={() => handleTileClick('Flat-fee bills paid')}
              />
            )}
          </Grid>
          <Grid item xs={12} sm={6} md={4} lg={3}>
            {loading ? (
              <Skeleton variant="rounded" height={120} />
            ) : (
              <StatCard
                title="New users (30 days)"
                value={stats.newUsersLast30Days}
                icon="solar:user-plus-rounded-bold-duotone"
                color="success"
                onClick={() => handleTileClick('New users (30 days)')}
              />
            )}
          </Grid>
          <Grid item xs={12} sm={6} md={4} lg={3}>
            {loading ? (
              <Skeleton variant="rounded" height={120} />
            ) : (
              <StatCard
                title="Eligibility checks"
                value={stats.eligibilityRequestsCount}
                icon="solar:chart-bold-duotone"
                color="primary"
                onClick={() => handleTileClick('Eligibility checks')}
              />
            )}
          </Grid>
        </Grid>

        <Divider />

        <Grid container spacing={3}>
          <Grid item xs={12} md={6}>
            <Card sx={{ p: 2.5, height: 360 }}>
              <Typography variant="subtitle1" sx={{ mb: 2 }}>
                Bills by status
              </Typography>
              {loading ? (
                <Skeleton variant="rounded" height={280} />
              ) : charts.billsByStatus.length === 0 ? (
                <Typography variant="body2" color="text.secondary">
                  No bill data available yet.
                </Typography>
              ) : (
                <BarChartBasic
                  data={charts.billsByStatus}
                  xKey="status"
                  yKey="count"
                  color={theme.vars.palette.primary.main}
                />
              )}
            </Card>
          </Grid>

          <Grid item xs={12} md={6}>
            <Card sx={{ p: 2.5, height: 360 }}>
              <Typography variant="subtitle1" sx={{ mb: 2 }}>
                Monthly flat-fee revenue (estimated)
              </Typography>
              {loading ? (
                <Skeleton variant="rounded" height={280} />
              ) : charts.monthlyFlatFeeRevenue.length === 0 ? (
                <Typography variant="body2" color="text.secondary">
                  No flat-fee revenue yet.
                </Typography>
              ) : (
                <LineChartBasic
                  data={charts.monthlyFlatFeeRevenue}
                  xKey="month"
                  yKey="revenue"
                  color={theme.vars.palette.success.main}
                />
              )}
            </Card>
          </Grid>
        </Grid>

        <Grid container spacing={3}>
          <Grid item xs={12} md={6}>
            <Card sx={{ p: 2.5, height: 360 }}>
              <Typography variant="subtitle1" sx={{ mb: 2 }}>
                Eligibility outcomes
              </Typography>
              {loading ? (
                <Skeleton variant="rounded" height={280} />
              ) : charts.eligibilityByType.length === 0 ? (
                <Typography variant="body2" color="text.secondary">
                  No eligibility calculations yet.
                </Typography>
              ) : (
                <DonutChartBasic data={charts.eligibilityByType} valueKey="count" labelKey="type" />
              )}
            </Card>
          </Grid>

          <Grid item xs={12} md={6}>
            <Card sx={{ p: 2.5, height: 360 }}>
              <Typography variant="subtitle1" sx={{ mb: 2 }}>
                Subscriptions by plan
              </Typography>
              {loading ? (
                <Skeleton variant="rounded" height={280} />
              ) : charts.subscriptionsByPlan.length === 0 ? (
                <Typography variant="body2" color="text.secondary">
                  No active subscriptions yet.
                </Typography>
              ) : (
                <BarChartBasic
                  data={charts.subscriptionsByPlan}
                  xKey="planId"
                  yKey="count"
                  color={theme.vars.palette.info.main}
                />
              )}
            </Card>
          </Grid>
        </Grid>
      </Stack>
    </DashboardContent>
  );
}

// ----------------------------------------------------------------------
// Lightweight chart wrappers using Recharts
// ----------------------------------------------------------------------

function BarChartBasic({ data, xKey, yKey, color }) {
  return (
    <ResponsiveContainer width="100%" height="100%">
      <BarChart data={data} margin={{ top: 8, right: 16, bottom: 24, left: 0 }}>
        <XAxis dataKey={xKey} tick={{ fontSize: 12 }} />
        <YAxis tick={{ fontSize: 12 }} />
        <Tooltip />
        <Bar dataKey={yKey} fill={color} radius={[4, 4, 0, 0]} />
      </BarChart>
    </ResponsiveContainer>
  );
}

function LineChartBasic({ data, xKey, yKey, color }) {
  return (
    <ResponsiveContainer width="100%" height="100%">
      <LineChart data={data} margin={{ top: 8, right: 16, bottom: 24, left: 0 }}>
        <XAxis dataKey={xKey} tick={{ fontSize: 12 }} />
        <YAxis tick={{ fontSize: 12 }} />
        <Tooltip />
        <Line
          type="monotone"
          dataKey={yKey}
          stroke={color}
          strokeWidth={2}
          dot={{ r: 3 }}
          activeDot={{ r: 5 }}
        />
      </LineChart>
    </ResponsiveContainer>
  );
}

const PIE_COLORS = ['#0088FE', '#00C49F', '#FFBB28', '#FF8042', '#B455FF', '#FF6699'];

function DonutChartBasic({ data, valueKey, labelKey }) {
  return (
    <ResponsiveContainer width="100%" height="100%">
      <PieChart>
        <Pie
          data={data}
          dataKey={valueKey}
          nameKey={labelKey}
          innerRadius="55%"
          outerRadius="80%"
          paddingAngle={3}
        >
          {data.map((entry, index) => (
            <Cell
              // eslint-disable-next-line react/no-array-index-key
              key={`slice-${entry[labelKey] || index}`}
              fill={PIE_COLORS[index % PIE_COLORS.length]}
            />
          ))}
        </Pie>
        <Tooltip />
        <Legend />
      </PieChart>
    </ResponsiveContainer>
  );
}
