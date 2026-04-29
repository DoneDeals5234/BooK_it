import { useState, useEffect } from 'react';
import { Label } from '@/components/ui/label';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { supabase } from '@/lib/supabase';
import { Loader2 } from 'lucide-react';

interface CampaignTarget {
  country: string;
  state?: string;
  district?: string;
  village?: string;
}

interface CampaignTargetSelectorProps {
  target: CampaignTarget;
  onChange: (target: CampaignTarget) => void;
}

export const CampaignTargetSelector = ({ target, onChange }: CampaignTargetSelectorProps) => {
  const [countries, setCountries] = useState<string[]>([]);
  const [states, setStates] = useState<string[]>([]);
  const [districts, setDistricts] = useState<string[]>([]);
  const [villages, setVillages] = useState<string[]>([]);
  const [loadingStates, setLoadingStates] = useState(false);
  const [loadingDistricts, setLoadingDistricts] = useState(false);
  const [loadingVillages, setLoadingVillages] = useState(false);

  // Load countries
  useEffect(() => {
    const loadCountries = async () => {
      const { data, error } = await supabase
        .from('user_profiles')
        .select('country')
        .not('country', 'is', null)
        .neq('country', '');

      if (!error && data) {
        const uniqueCountries = [...new Set(data.map(d => d.country))].filter(Boolean).sort();
        setCountries(uniqueCountries);
      }
    };

    loadCountries();
  }, []);

  // Load states when country changes
  useEffect(() => {
    if (!target.country) {
      setStates([]);
      setDistricts([]);
      setVillages([]);
      return;
    }

    const loadStates = async () => {
      setLoadingStates(true);
      const { data, error } = await supabase
        .from('user_profiles')
        .select('state')
        .eq('country', target.country)
        .not('state', 'is', null)
        .neq('state', '');

      if (!error && data) {
        const uniqueStates = [...new Set(data.map(d => d.state))].filter(Boolean).sort();
        setStates(uniqueStates);
      }
      setLoadingStates(false);
    };

    loadStates();
  }, [target.country]);

  // Load districts when state changes
  useEffect(() => {
    if (!target.state) {
      setDistricts([]);
      setVillages([]);
      return;
    }

    const loadDistricts = async () => {
      setLoadingDistricts(true);
      const { data, error } = await supabase
        .from('user_profiles')
        .select('district')
        .eq('country', target.country)
        .eq('state', target.state)
        .not('district', 'is', null)
        .neq('district', '');

      if (!error && data) {
        const uniqueDistricts = [...new Set(data.map(d => d.district))].filter(Boolean).sort();
        setDistricts(uniqueDistricts);
      }
      setLoadingDistricts(false);
    };

    loadDistricts();
  }, [target.country, target.state]);

  // Load villages when district changes
  useEffect(() => {
    if (!target.district) {
      setVillages([]);
      return;
    }

    const loadVillages = async () => {
      setLoadingVillages(true);
      const { data, error } = await supabase
        .from('user_profiles')
        .select('village')
        .eq('country', target.country)
        .eq('state', target.state)
        .eq('district', target.district)
        .not('village', 'is', null)
        .neq('village', '');

      if (!error && data) {
        const uniqueVillages = [...new Set(data.map(d => d.village))].filter(Boolean).sort();
        setVillages(uniqueVillages);
      }
      setLoadingVillages(false);
    };

    loadVillages();
  }, [target.country, target.state, target.district]);

  return (
    <Card>
      <CardHeader>
        <CardTitle className="text-base">Geographic Targeting</CardTitle>
        <CardDescription>Select the area where you want to send notifications</CardDescription>
      </CardHeader>
      <CardContent className="space-y-4">
        {/* Country */}
        <div className="space-y-2">
          <Label htmlFor="country">Country *</Label>
          <select
            id="country"
            value={target.country}
            onChange={(e) => {
              onChange({
                country: e.target.value,
                state: undefined,
                district: undefined,
                village: undefined,
              });
            }}
            className="w-full px-3 py-2 border rounded-md bg-background text-foreground text-sm"
          >
            <option value="">Select a country</option>
            {countries.map(c => (
              <option key={c} value={c}>{c}</option>
            ))}
          </select>
          {countries.length === 0 && (
            <p className="text-xs text-muted-foreground">No countries available</p>
          )}
        </div>

        {/* State */}
        <div className="space-y-2">
          <Label htmlFor="state">
            State / Province
            {states.length > 0 && <span className="text-muted-foreground ml-1">(Optional)</span>}
          </Label>
          <select
            id="state"
            value={target.state || ''}
            onChange={(e) => {
              onChange({
                ...target,
                state: e.target.value || undefined,
                district: undefined,
                village: undefined,
              });
            }}
            disabled={!target.country || loadingStates}
            className="w-full px-3 py-2 border rounded-md bg-background text-foreground text-sm disabled:opacity-50"
          >
            <option value="">
              {loadingStates ? 'Loading...' : 'All states'}
            </option>
            {states.map(s => (
              <option key={s} value={s}>{s}</option>
            ))}
          </select>
        </div>

        {/* District */}
        <div className="space-y-2">
          <Label htmlFor="district">
            District
            {districts.length > 0 && <span className="text-muted-foreground ml-1">(Optional)</span>}
          </Label>
          <select
            id="district"
            value={target.district || ''}
            onChange={(e) => {
              onChange({
                ...target,
                district: e.target.value || undefined,
                village: undefined,
              });
            }}
            disabled={!target.state || loadingDistricts}
            className="w-full px-3 py-2 border rounded-md bg-background text-foreground text-sm disabled:opacity-50"
          >
            <option value="">
              {loadingDistricts ? 'Loading...' : 'All districts'}
            </option>
            {districts.map(d => (
              <option key={d} value={d}>{d}</option>
            ))}
          </select>
        </div>

        {/* Village */}
        <div className="space-y-2">
          <Label htmlFor="village">
            Village
            {villages.length > 0 && <span className="text-muted-foreground ml-1">(Optional)</span>}
          </Label>
          <select
            id="village"
            value={target.village || ''}
            onChange={(e) => {
              onChange({
                ...target,
                village: e.target.value || undefined,
              });
            }}
            disabled={!target.district || loadingVillages}
            className="w-full px-3 py-2 border rounded-md bg-background text-foreground text-sm disabled:opacity-50"
          >
            <option value="">
              {loadingVillages ? 'Loading...' : 'All villages'}
            </option>
            {villages.map(v => (
              <option key={v} value={v}>{v}</option>
            ))}
          </select>
        </div>

        {/* Summary */}
        {target.country && (
          <div className="mt-4 p-3 bg-muted rounded-lg">
            <p className="text-xs font-semibold text-muted-foreground mb-1">TARGETING SUMMARY</p>
            <p className="text-sm">
              {target.village && `${target.village}, `}
              {target.district && `${target.district}, `}
              {target.state && `${target.state}, `}
              {target.country}
            </p>
          </div>
        )}
      </CardContent>
    </Card>
  );
};
