import { Helmet } from 'react-helmet-async';

import { CONFIG } from 'src/config-global';

import { RefundRequestsView } from 'src/sections/refund-requests/view';

// ----------------------------------------------------------------------

const metadata = { title: `Refund Requests | Dashboard - ${CONFIG.appName}` };

export default function Page() {
  return (
    <>
      <Helmet>
        <title>{metadata.title}</title>
      </Helmet>

      <RefundRequestsView />
    </>
  );
}
