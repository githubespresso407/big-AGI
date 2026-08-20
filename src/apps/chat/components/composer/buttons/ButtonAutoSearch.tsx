import * as React from 'react';
import { useShallow } from 'zustand/react/shallow';

import { Box, Button, IconButton, Tooltip } from '@mui/joy';
import { SxProps } from '@mui/joy/styles/types';
import AutoAwesomeIcon from '@mui/icons-material/AutoAwesome';
import TravelExploreIcon from '@mui/icons-material/TravelExplore';

import type { AutoSearchMode } from '~/modules/jina/store-module-jina';
import { useJinaStore } from '~/modules/jina/store-module-jina';


// [Jina patch] Auto web search: 3-state composer toggle.
// - off: messages sent untouched
// - auto: a fast LLM gate decides per message whether to search, and rewrites the query standalone (uses chat context)
// - always: every message is searched (same context-aware query rewrite)

const NEXT_MODE: Record<AutoSearchMode, AutoSearchMode> = { off: 'auto', auto: 'always', always: 'off' };

const MODE_LABEL: Record<AutoSearchMode, string> = { off: 'Web', auto: 'Web: Auto', always: 'Web: All' };

const legend = (mode: AutoSearchMode) =>
  <Box sx={{ px: 1, py: 0.75, lineHeight: '1.5rem' }}>
    Auto web search: <b>{mode === 'off' ? 'OFF' : mode === 'auto' ? 'AUTO' : 'ALWAYS'}</b><br />
    {mode === 'off'
      ? 'Click to let the assistant decide when to search the web (Auto).'
      : mode === 'auto'
        ? 'A fast model decides per message whether fresh web results are needed, and rewrites follow-ups into standalone queries.'
        : 'Every message is answered with fresh web results. Follow-up questions are rewritten with the conversation context.'}
    <br />Click to cycle: Off &gt; Auto &gt; Always.
  </Box>;

const mobileSx: SxProps = {
  mr: { xs: 1, md: 2 },
} as const;

const desktopSx: SxProps = {
  '--Button-gap': '1rem',
} as const;


export const ButtonAutoSearchMemo = React.memo(ButtonAutoSearch);

function ButtonAutoSearch(props: { isMobile?: boolean, disabled?: boolean }) {

  const { autoSearchMode, setAutoSearchMode } = useJinaStore(useShallow(state => ({
    autoSearchMode: state.autoSearchMode,
    setAutoSearchMode: state.setAutoSearchMode,
  })));

  const handleCycle = React.useCallback(() => setAutoSearchMode(NEXT_MODE[autoSearchMode]), [autoSearchMode, setAutoSearchMode]);

  const isOn = autoSearchMode !== 'off';
  const icon = autoSearchMode === 'auto' ? <AutoAwesomeIcon /> : <TravelExploreIcon />;

  return props.isMobile ? (
    <IconButton
      variant={isOn ? 'solid' : 'soft'} color={autoSearchMode === 'always' ? 'warning' : 'primary'}
      disabled={props.disabled} onClick={handleCycle} sx={mobileSx}
    >
      {icon}
    </IconButton>
  ) : (
    <Tooltip disableInteractive variant='solid' arrow placement='right' title={legend(autoSearchMode)}>
      <Button
        variant={isOn ? 'solid' : 'soft'} color={autoSearchMode === 'always' ? 'warning' : 'primary'}
        disabled={props.disabled} onClick={handleCycle}
        endDecorator={icon} sx={desktopSx}
      >
        {MODE_LABEL[autoSearchMode]}
      </Button>
    </Tooltip>
  );
}
