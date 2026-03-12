import { Helmet } from 'react-helmet-async';

import { CONFIG } from 'src/config-global';

import { SubscriptionsView } from 'src/sections/subscriptions/view';

// ----------------------------------------------------------------------

const metadata = { title: `Subscriptions | Dashboard - ${CONFIG.appName}` };

export default function Page() {
  return (
    <>
      <Helmet>
        <title>{metadata.title}</title>
      </Helmet>

      <SubscriptionsView />
    </>
  );
}

