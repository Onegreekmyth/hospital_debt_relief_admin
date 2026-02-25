import { Helmet } from 'react-helmet-async';

import { CONFIG } from 'src/config-global';

import { PageTwoView } from 'src/sections/page-two/view';

// ----------------------------------------------------------------------

const metadata = { title: `Bill Approval | Dashboard - ${CONFIG.appName}` };

export default function Page() {
  return (
    <>
      <Helmet>
        <title>{metadata.title}</title>
      </Helmet>

      <PageTwoView />
    </>
  );
}
