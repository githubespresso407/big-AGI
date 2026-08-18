import * as React from 'react';
import { useShallow } from 'zustand/react/shallow';

import { Box, Button, IconButton, Tooltip } from '@mui/joy';
import { SxProps } from '@mui/joy/styles/types';
import TravelExploreIcon from '@mui/icons-material/TravelExplore';

import { useJinaStore } from '~/modules/jina/store-module-jina';


// [Jina patch] Auto web search: when ON, every outgoing message is augmented with fresh web results (Jina Search + Reader)

const legend = (enabled: boolean) =>
  <Box sx={{ px: 1, py: 0.75, lineHeight: '1.5rem' }}>
    Auto web search: <b>{enabled ? 'ON' : 'OFF'}</b><br />
    {enabled
      ? 'Every message is answered with fresh web results (via Jina). Follow-up questions reuse the conversation subject.'
      : 'Click to have every message answered with fresh web results (via Jina).'}
  </Box>;

const mobileSx: SxProps = {
  mr: { xs: 1, md: 2 },
} as const;

const desktopSx: SxProps = {
  '--Button-gap': '1rem',
} as const;


export const ButtonAutoSearchMemo = React.memo(ButtonAutoSearch);

function ButtonAutoSearch(props: { isMobile?: boolean, disabled?: boolean }) {

  const { autoSearchEnabled, setAutoSearchEnabled } = useJinaStore(useShallow(state => ({
    autoSearchEnabled: state.autoSearchEnabled,
    setAutoSearchEnabled: state.setAutoSearchEnabled,
  })));

  const handleToggle = React.useCallback(() => setAutoSearchEnabled(!autoSearchEnabled), [autoSearchEnabled, setAutoSearchEnabled]);

  return props.isMobile ? (
    <IconButton
      variant={autoSearchEnabled ? 'solid' : 'soft'} color='primary'
      disabled={props.disabled} onClick={handleToggle} sx={mobileSx}
    >
      <TravelExploreIcon />
    </IconButton>
  ) : (
    <Tooltip disableInteractive variant='solid' arrow placement='right' title={legend(autoSearchEnabled)}>
      <Button
        variant={autoSearchEnabled ? 'solid' : 'soft'} color='primary'
        disabled={props.disabled} onClick={handleToggle}
        endDecorator={<TravelExploreIcon />} sx={desktopSx}
      >
        Web
      </Button>
    </Tooltip>
  );
}
