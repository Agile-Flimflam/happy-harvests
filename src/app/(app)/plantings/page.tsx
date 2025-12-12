import { PlantingsPageContent } from './_components/PlantingsPageContent';
import { getPlantingOptions, loadPlantingDraft } from './_actions';
import { getQuickActionContext } from '../actions';

type PlantingsSearchParams = {
  schedule?: string;
  mode?: 'nursery' | 'direct';
  bedId?: string;
  nurseryId?: string;
};

export default async function PlantingsPage({
  searchParams,
}: {
  searchParams?: Promise<PlantingsSearchParams>;
}) {
  const [optionsRes, quickContextRes, draft] = await Promise.all([
    getPlantingOptions(),
    getQuickActionContext(),
    loadPlantingDraft(),
  ]);

  const sp = searchParams ? await searchParams : undefined;
  const scheduleDate = typeof sp?.schedule === 'string' ? sp.schedule : undefined;
  const defaultBedId = sp?.bedId && !Number.isNaN(Number(sp.bedId)) ? Number(sp.bedId) : null;
  const defaultNurseryId = typeof sp?.nurseryId === 'string' ? sp.nurseryId : null;

  return (
    <PlantingsPageContent
      cropVarieties={optionsRes.varieties ?? []}
      beds={optionsRes.beds ?? []}
      nurseries={optionsRes.nurseries ?? []}
      locations={optionsRes.locations ?? []}
      plots={optionsRes.plots ?? []}
      scheduleDate={scheduleDate}
      defaultBedId={defaultBedId}
      defaultNurseryId={defaultNurseryId}
      creationContext={quickContextRes.ok ? quickContextRes.data : undefined}
      serverDraft={draft}
      optionsError={optionsRes.error}
      prefs={optionsRes.prefs}
      templates={optionsRes.templates}
    />
  );
}
