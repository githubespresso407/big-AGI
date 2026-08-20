import * as React from 'react';
import { useShallow } from 'zustand/react/shallow';

import { FormControl, FormHelperText, Input, Option, Select, Typography } from '@mui/joy';
import KeyIcon from '@mui/icons-material/Key';
import SearchIcon from '@mui/icons-material/Search';

import { getBackendCapabilities } from '~/modules/backend/store-backend-capabilities';
import { isValidJinaApiKey, useJinaStore } from '~/modules/jina/store-module-jina';
import { isValidExaApiKey, useExaStore } from '~/modules/exa/store-module-exa'; // [Exa patch]

import { ExternalLink } from '~/common/components/ExternalLink';
import { FormInputKey } from '~/common/components/forms/FormInputKey';
import { FormLabelStart } from '~/common/components/forms/FormLabelStart';
import { Link } from '~/common/components/Link';

import { isValidGoogleCloudApiKey, isValidGoogleCseId } from './search.client';
import { useGoogleSearchStore } from './store-module-google';


export function GoogleSearchSettings() {

  // external state
  const backendHasGoogle = getBackendCapabilities().hasGoogleCustomSearch;
  const { googleCloudApiKey, setGoogleCloudApiKey, googleCSEId, setGoogleCSEId, restrictToDomain, setRestrictToDomain } = useGoogleSearchStore(useShallow(state => ({
    googleCloudApiKey: state.googleCloudApiKey, setGoogleCloudApiKey: state.setGoogleCloudApiKey,
    googleCSEId: state.googleCSEId, setGoogleCSEId: state.setGoogleCSEId,
    restrictToDomain: state.restrictToDomain, setRestrictToDomain: state.setRestrictToDomain,
  })));
  const { jinaApiKey, setJinaApiKey } = useJinaStore(useShallow(state => ({
    jinaApiKey: state.jinaApiKey,
    setJinaApiKey: state.setJinaApiKey,
  })));
  const { autoSearchMode, setAutoSearchMode } = useJinaStore(useShallow(state => ({
    autoSearchMode: state.autoSearchMode,
    setAutoSearchMode: state.setAutoSearchMode,
  })));


  // derived state
  const isValidKey = googleCloudApiKey ? isValidGoogleCloudApiKey(googleCloudApiKey) : backendHasGoogle;
  const isValidId = googleCSEId ? isValidGoogleCseId(googleCSEId) : backendHasGoogle;
  const isJinaValid = isValidJinaApiKey(jinaApiKey); // [Jina patch] valid Jina key substitutes for Google PSE
  const { exaApiKey, setExaApiKey } = useExaStore(useShallow(state => ({ // [Exa patch]
    exaApiKey: state.exaApiKey,
    setExaApiKey: state.setExaApiKey,
  })));
  const isExaValid = isValidExaApiKey(exaApiKey); // [Exa patch] valid Exa key is preferred over Jina for search
  const googleSatisfied = (isValidKey && isValidId) || isExaValid || isJinaValid;


  const handleGoogleApiKeyChange = (e: React.ChangeEvent<HTMLInputElement>) => setGoogleCloudApiKey(e.target.value);

  const handleCseIdChange = (e: React.ChangeEvent<HTMLInputElement>) => setGoogleCSEId(e.target.value);

  const handleDomainChange = (e: React.ChangeEvent<HTMLInputElement>) => setRestrictToDomain(e.target.value);


  return <>

    <Typography level='body-sm'>
      For custom search engines or domain-specific searches. Most models have native search capabilities. Uses the Google <ExternalLink href='https://developers.google.com/custom-search/v1/overview'>Programmable Search Engine</ExternalLink> API, or <ExternalLink href='https://jina.ai'>Jina Search</ExternalLink> as an alternative (single key, no CSE setup).
    </Typography>

    {/* [Jina patch] Jina Search key - used when the Google PSE credentials below are not set */}
    <FormInputKey
      autoCompleteId='jina-search-key' label='Jina API Key'
      description={<>Simplest option - get one at <Link href='https://jina.ai' noLinkStyle target='_blank'>jina.ai</Link></>}
      value={jinaApiKey} onChange={setJinaApiKey}
      required={false} isError={!!jinaApiKey && !isJinaValid}
      placeholder='jina_...'
    />

    {/* [Exa patch] Exa Search key - preferred over Jina when set (Jina stays the browse/reader backend) */}
    <FormInputKey
      autoCompleteId='exa-key' label='Exa API Key'
      description={<>Neural web search - get one at <Link href='https://exa.ai' noLinkStyle target='_blank'>exa.ai</Link></>}
      value={exaApiKey} onChange={setExaApiKey}
      required={false} isError={!!exaApiKey && !isExaValid}
      placeholder='00000000-0000-...'
    />

    <FormControl orientation='horizontal' sx={{ justifyContent: 'space-between', alignItems: 'center' }}>
      <FormLabelStart title='GCP API Key'
                      description={<>Create one <Link href='https://console.cloud.google.com/apis/credentials' noLinkStyle target='_blank'>here</Link></>}
                      tooltip='Create your Google Cloud "API Key Credential" and enter it here' />
      <Input
        variant='outlined' placeholder={backendHasGoogle ? '...' : (isExaValid ? 'unused (Exa)' : isJinaValid ? 'unused (Jina)' : 'missing')} error={!googleSatisfied && !isValidKey}
        value={googleCloudApiKey} onChange={handleGoogleApiKeyChange}
        startDecorator={<KeyIcon />}
        slotProps={{ input: { sx: { width: '100%' } } }}
        sx={{ width: '100%' }}
      />
    </FormControl>

    <FormControl orientation='horizontal' sx={{ justifyContent: 'space-between', alignItems: 'center' }}>
      <FormLabelStart title='Search Engine ID'
                      description={<>Get it <Link href='https://programmablesearchengine.google.com/' noLinkStyle target='_blank'>here</Link></>}
                      tooltip='Create your Google "Programmable Search Engine" and enter its ID here' />
      <Input
        variant='outlined' placeholder={backendHasGoogle ? '...' : (isExaValid ? 'unused (Exa)' : isJinaValid ? 'unused (Jina)' : 'missing')} error={!googleSatisfied && !isValidId}
        value={googleCSEId} onChange={handleCseIdChange}
        startDecorator={<SearchIcon />}
        slotProps={{ input: { sx: { width: '100%' } } }}
        sx={{ width: '100%' }}
      />
    </FormControl>

    <FormControl orientation='horizontal' sx={{ justifyContent: 'space-between', alignItems: 'center' }}>
      <FormLabelStart title='Restrict to Domain'
                      description='Optional'
                      tooltip='Limit searches to a specific domain (e.g., "wikipedia.org")' />
      <Input
        variant='outlined' placeholder='example.com'
        value={restrictToDomain} onChange={handleDomainChange}
        // startDecorator={<LanguageIcon />}
        slotProps={{ input: { sx: { width: '100%' } } }}
        sx={{ width: '100%' }}
      />
    </FormControl>

    {/* [Jina patch] auto-search mode (same control as the composer Web button; useful on mobile) */}
    <FormControl orientation='horizontal' sx={{ justifyContent: 'space-between', alignItems: 'center' }}>
      <FormLabelStart title='Auto web search'
                      description='Same as the composer Web button'
                      tooltip='Auto: a fast model decides per message whether a web search is needed and rewrites the query with chat context. Always: search on every message.' />
      <Select
        size='sm' value={autoSearchMode}
        onChange={(_event, value) => value && setAutoSearchMode(value)}
        sx={{ minWidth: 140 }}
      >
        <Option value='off'>Off</Option>
        <Option value='auto'>Auto</Option>
        <Option value='always'>Always</Option>
      </Select>
    </FormControl>
    <FormHelperText sx={{ fontSize: 'xs' }}>
      Answers plain chat messages with fresh web results - no /react needed. Follow-ups like &quot;when will it be released?&quot; are searched with the conversation subject.
    </FormHelperText>

  </>;
}