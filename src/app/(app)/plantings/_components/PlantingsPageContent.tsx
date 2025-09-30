'use client';

import { useState } from 'react';
import type { Tables, Enums } from '@/lib/supabase-server';
import { Button } from "@/components/ui/button";
import { ConfirmDialog } from '@/components/ui/confirm-dialog';
import FormDialog from "@/components/dialogs/FormDialog";
import { Card } from "@/components/ui/card";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Badge } from "@/components/ui/badge";
// import { PlantingForm } from './PlantingForm'; // legacy
import { deletePlanting } from '../_actions';
import { NurserySowForm } from './NurserySowForm';
import { DirectSeedForm } from './DirectSeedForm';
import {
  Pencil,
  Trash2,
  PlusCircle,
  Sprout,
  Leaf,
  ShoppingBasket,
  TrendingUp
} from 'lucide-react';
import { toast } from "sonner";
import PageHeader from '@/components/page-header';
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu';
import PageContent from '@/components/page-content';

type Planting = Tables<'plantings'>;
type CropVariety = Pick<Tables<'crop_varieties'>, 'id' | 'name' | 'latin_name'> & { crops?: { name: string } | null };
type Bed = Pick<Tables<'beds'>, 'id' | 'length_inches' | 'width_inches'> & { plots?: { locations: { name: string } | null } | null };

type PlantingWithDetails = Planting & {
  crop_varieties: { name: string; latin_name: string; crops: { name: string } | null } | null;
  beds: { id: number; length_inches: number | null; width_inches: number | null; plots: { locations: { name: string } | null } | null } | null;
  nurseries: { name: string } | null;
};

interface PlantingsPageContentProps {
  plantings: PlantingWithDetails[];
  cropVarieties: CropVariety[];
  beds: Bed[];
  nurseries: { id: string; name: string }[];
}

export function PlantingsPageContent({ plantings, cropVarieties, beds, nurseries: _nurseries }: PlantingsPageContentProps) {
  const [isDialogOpen, setIsDialogOpen] = useState(false);
  const [deleteId, setDeleteId] = useState<number | null>(null);
  const [deleting, setDeleting] = useState(false);
  const [createMode, setCreateMode] = useState<'nursery' | 'direct' | null>(null);

  const handleEdit = () => {
    toast.error('Edit not implemented yet');
  };
  const openNurserySow = () => { setCreateMode('nursery'); setIsDialogOpen(true); };
  const openDirectSeed = () => { setCreateMode('direct'); setIsDialogOpen(true); };
  const closeDialog = () => {
    setIsDialogOpen(false);
    setCreateMode(null);
  };

  const openDelete = (id: number) => setDeleteId(id);
  const confirmDelete = async () => {
    if (deleteId == null) return;
    try {
      setDeleting(true);
      const result = await deletePlanting(deleteId);
      if (result.message.startsWith('Database Error:') || result.message.startsWith('Error:')) {
        toast.error(result.message);
      } else {
        toast.success(result.message);
      }
    } finally {
      setDeleting(false);
      setDeleteId(null);
    }
  };

  const statusVariant = (status: Enums<'planting_status'> | null): "default" | "secondary" | "destructive" | "outline" | null | undefined => {
    switch (status) {
      case 'planted': return 'default';
      case 'nursery': return 'secondary';
      case 'harvested': return 'outline';
      default: return 'secondary';
    }
  };

  const getStatusStats = () => {
    const nurseryCount = plantings.filter(p => p.status === 'nursery').length;
    const plantedCount = plantings.filter(p => p.status === 'planted').length;
    const harvestedCount = plantings.filter(p => p.status === 'harvested').length;

    return {
      total: plantings.length,
      nursery: nurseryCount,
      planted: plantedCount,
      harvested: harvestedCount
    };
  };

  const stats = getStatusStats();



  const renderEmptyState = () => (
    <div className="text-center py-12">
      <div className="mx-auto w-24 h-24 bg-muted rounded-full flex items-center justify-center mb-4">
        <Sprout className="h-12 w-12 text-muted-foreground" />
      </div>
      <h3 className="text-lg font-semibold mb-2">No plantings recorded</h3>
      <p className="text-muted-foreground mb-6 max-w-md mx-auto">Add your first planting to get started.</p>
      <DropdownMenu>
        <DropdownMenuTrigger asChild>
          <Button size="lg">
            <PlusCircle className="h-5 w-5 mr-2" />
            Add Your First Planting
          </Button>
        </DropdownMenuTrigger>
        <DropdownMenuContent align="center">
          <DropdownMenuItem onClick={openNurserySow}>Nursery sow</DropdownMenuItem>
          <DropdownMenuItem onClick={openDirectSeed}>Direct seed</DropdownMenuItem>
        </DropdownMenuContent>
      </DropdownMenu>
    </div>
  );

  return (
    <div>
      <PageHeader
        title="Plantings"
        action={(
          <DropdownMenu>
            <DropdownMenuTrigger asChild>
              <Button size="sm" className="w-full sm:w-auto">
                <PlusCircle className="h-4 w-4 mr-2" />
                Add Planting
              </Button>
            </DropdownMenuTrigger>
            <DropdownMenuContent align="end">
              <DropdownMenuItem onClick={openNurserySow}>Nursery sow</DropdownMenuItem>
              <DropdownMenuItem onClick={openDirectSeed}>Direct seed</DropdownMenuItem>
            </DropdownMenuContent>
          </DropdownMenu>
        )}
      />

      {createMode && (
        <FormDialog
          open={isDialogOpen}
          onOpenChange={setIsDialogOpen}
          title={createMode === 'nursery' ? 'Nursery sow' : 'Direct seed'}
          description={createMode === 'nursery' ? 'Start in nursery' : 'Seed directly in field'}
          submitLabel={createMode === 'nursery' ? 'Create Nursery Planting' : 'Create Direct Seed Planting'}
          formId={createMode === 'nursery' ? 'nurserySowForm' : 'directSeedForm'}
          className="sm:max-w-md"
        >
          {createMode === 'nursery' && (
            <NurserySowForm cropVarieties={cropVarieties} nurseries={_nurseries} closeDialog={closeDialog} formId="nurserySowForm" />
          )}
          {createMode === 'direct' && (
            <DirectSeedForm cropVarieties={cropVarieties} beds={beds} closeDialog={closeDialog} formId="directSeedForm" />
          )}
        </FormDialog>
      )}

      <ConfirmDialog
        open={deleteId != null}
        onOpenChange={(open) => { if (!open) setDeleteId(null); }}
        title="Delete planting?"
        description="This action cannot be undone."
        confirmText="Delete"
        confirmVariant="destructive"
        confirming={deleting}
        onConfirm={confirmDelete}
      />

      <PageContent>
        {plantings.length === 0 ? (
          renderEmptyState()
        ) : (
          <div className="space-y-6">
            {/* Summary Stats */}
            <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
              <Card className="p-4">
                <div className="flex items-center gap-3">
                  <div className="p-2 rounded-lg bg-blue-50 dark:bg-blue-950">
                    <Leaf className="h-5 w-5 text-blue-600" />
                  </div>
                  <div>
                    <p className="text-2xl font-bold">{stats.nursery}</p>
                    <p className="text-sm text-muted-foreground">In Nursery</p>
                  </div>
                </div>
              </Card>
              <Card className="p-4">
                <div className="flex items-center gap-3">
                  <div className="p-2 rounded-lg bg-green-50 dark:bg-green-950">
                    <Sprout className="h-5 w-5 text-green-600" />
                  </div>
                  <div>
                    <p className="text-2xl font-bold">{stats.planted}</p>
                    <p className="text-sm text-muted-foreground">Planted</p>
                  </div>
                </div>
              </Card>
              <Card className="p-4">
                <div className="flex items-center gap-3">
                  <div className="p-2 rounded-lg bg-orange-50 dark:bg-orange-950">
                    <ShoppingBasket className="h-5 w-5 text-orange-600" />
                  </div>
                  <div>
                    <p className="text-2xl font-bold">{stats.harvested}</p>
                    <p className="text-sm text-muted-foreground">Harvested</p>
                  </div>
                </div>
              </Card>
              <Card className="p-4">
                <div className="flex items-center gap-3">
                  <div className="p-2 rounded-lg bg-gray-50 dark:bg-gray-950">
                    <TrendingUp className="h-5 w-5 text-gray-600" />
                  </div>
                  <div>
                    <p className="text-2xl font-bold">{stats.total}</p>
                    <p className="text-sm text-muted-foreground">Total</p>
                  </div>
                </div>
              </Card>
            </div>

            {/* Plantings Table */}
            <div className="border rounded-lg overflow-hidden">
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>Variety</TableHead>
                    <TableHead>Crop</TableHead>
                    <TableHead>Bed</TableHead>
                    <TableHead>Type</TableHead>
                    <TableHead>Qty</TableHead>
                    <TableHead>Planted</TableHead>
                    <TableHead>Status</TableHead>
                    <TableHead className="text-right">Actions</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {plantings.map((p) => (
                    <TableRow key={p.id}>
                      <TableCell className="font-medium">{p.crop_varieties?.name ?? 'N/A'}</TableCell>
                      <TableCell>{p.crop_varieties?.crops?.name ?? 'N/A'}</TableCell>
                      <TableCell>
                        {p.status === 'nursery'
                          ? (p.nurseries?.name ?? 'Nursery')
                          : (
                            <>Bed #{p.beds?.id} ({p.beds?.length_inches ?? '?'}x{p.beds?.width_inches ?? '?'}) @{p.beds?.plots?.locations?.name ?? 'N/A'}</>
                          )}
                      </TableCell>
                      <TableCell>{p.propagation_method}</TableCell>
                      <TableCell>{p.qty_initial}</TableCell>
                      <TableCell>{p.planted_date ?? '-'}</TableCell>
                      <TableCell>
                        <Badge variant={statusVariant(p.status)}>{p.status}</Badge>
                      </TableCell>
                      <TableCell className="text-right">
                        <Button variant="ghost" size="icon" onClick={handleEdit} className="mr-2" disabled>
                          <Pencil className="h-4 w-4" />
                        </Button>
                        <Button variant="ghost" size="icon" onClick={() => openDelete(p.id)} className="text-red-500 hover:text-red-700">
                          <Trash2 className="h-4 w-4" />
                        </Button>
                      </TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
            </div>
          </div>
        )}
      </PageContent>
    </div>
  );
}


