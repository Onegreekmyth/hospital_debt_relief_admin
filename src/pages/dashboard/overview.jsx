import { Helmet } from 'react-helmet-async';

import { CONFIG } from 'src/config-global';

import { OverviewView } from 'src/sections/overview/view';

// ----------------------------------------------------------------------

const metadata = { title: `Dashboard | ${CONFIG.appName}` };

export default function Page() {
  return (
    <>
      <Helmet>
        <title>{metadata.title}</title>
      </Helmet>
      <OverviewView />
    </>
  );
}
