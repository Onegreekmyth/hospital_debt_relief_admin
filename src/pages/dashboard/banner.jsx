import { Helmet } from 'react-helmet-async';

import { CONFIG } from 'src/config-global';

import { BannerView } from 'src/sections/banner/view';

// ----------------------------------------------------------------------

const metadata = { title: `Banner | Dashboard - ${CONFIG.appName}` };

export default function Page() {
  return (
    <>
      <Helmet>
        <title>{metadata.title}</title>
      </Helmet>
      <BannerView />
    </>
  );
}
