import { Helmet } from 'react-helmet-async';

import { CONFIG } from 'src/config-global';

import { ApplicationFormView } from 'src/sections/application-form/view';

// ----------------------------------------------------------------------

const metadata = { title: `Application Form Editor | Dashboard - ${CONFIG.appName}` };

export default function Page() {
  return (
    <>
      <Helmet>
        <title>{metadata.title}</title>
      </Helmet>

      <ApplicationFormView />
    </>
  );
}
