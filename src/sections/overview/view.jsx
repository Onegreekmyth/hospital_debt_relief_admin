import { useState, useEffect, useCallback } from 'react';

import Box from '@mui/material/Box';
import Card from '@mui/material/Card';
import Stack from '@mui/material/Stack';
import Typography from '@mui/material/Typography';
import Grid from '@mui/material/Grid';
import Skeleton from '@mui/material/Skeleton';

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
  return { totalBills: total, pendingBills: pending, approvedBills: approved, incompleteBills: incomplete };
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
};

const PALETTE_KEYS_WITH_MAIN = ['primary', 'secondary', 'success', 'warning', 'error', 'info'];

function StatCard({ title, value, icon, color = 'primary' }) {
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
      }}
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
  const [stats, setStats] = useState(DEFAULT_STATS);
  const [loading, setLoading] = useState(true);

  const fetchStats = useCallback(async () => {
    try {
      setLoading(true);
      let nextStats = { ...DEFAULT_STATS };

      try {
        const res = await axios.get(endpoints.analytics.stats);
        if (res.data?.success && res.data?.data) {
          nextStats = { ...DEFAULT_STATS, ...res.data.data };
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
              />
            )}
          </Grid>
        </Grid>
      </Stack>
    </DashboardContent>
  );
}
