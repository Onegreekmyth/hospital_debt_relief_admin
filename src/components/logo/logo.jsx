import { forwardRef } from 'react';

import Box from '@mui/material/Box';

import { CONFIG } from 'src/config-global';
import { RouterLink } from 'src/routes/components';

import { logoClasses } from './classes';

// ----------------------------------------------------------------------

export const Logo = forwardRef(
  (
    { width, href = '/', height, isSingle = true, disableLink = false, className, sx, ...other },
    ref
  ) => {
    const singleLogo = (
      <Box
        alt="Hospital Debt Relief logo"
        component="img"
        src={`${CONFIG.assetsDir}/logo/logo-single.png`}
        width="100%"
        height="100%"
      
      />
    );

    const fullLogo = (
      <Box
        alt="Hospital Debt Relief logo"
        component="img"
        src={`${CONFIG.assetsDir}/logo/logo-full.png`}
        width="100%"
        height="100%"
      />
    );

    const baseSize = {
      width: width ?? 40,
      height: height ?? 40,
      ...(!isSingle && {
        width: width ?? 102,
        height: height ?? 36,
      }),
    };

    return (
      <Box
        ref={ref}
        component={RouterLink}
        href={href}
        className={logoClasses.root.concat(className ? ` ${className}` : '')}
        aria-label="Logo"
        sx={{
          ...baseSize,
          flexShrink: 0,
          display: 'inline-flex',
          verticalAlign: 'middle',
          ...(disableLink && { pointerEvents: 'none' }),
          ...sx,
        }}
        {...other}
      >
        {isSingle ? singleLogo : fullLogo}
      </Box>
    );
  }
);
