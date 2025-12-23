import { Helmet } from 'react-helmet-async';

import { CONFIG } from 'src/config-global';

import { PageOneView } from 'src/sections/page-one/view';

// ----------------------------------------------------------------------

const metadata = { title: `Page one | Dashboard - ${CONFIG.appName}` };

export default function Page() {
  return (
    <>
      <Helmet>
        <title> {metadata.title}</title>
      </Helmet>

      <PageOneView />
    </>
  );
}
