'use client';

import { useState } from 'react';
import type { Tables, Enums } from '@/lib/supabase-server';
import { Button } from "@/components/ui/button";
import { ConfirmDialog } from '@/components/ui/confirm-dialog';
import FormDialog from "@/components/dialogs/FormDialog";
import { Card } from "@/components/ui/card";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Badge } from "@/components/ui/badge";
import { PlantingForm } from './PlantingForm';
import { deletePlanting } from '../_actions';
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
import PageContent from '@/components/page-content';

type Planting = Tables<'bed_plantings'>;
type CropVariety = Pick<Tables<'crop_varieties'>, 'id' | 'name' | 'latin_name'> & { crops?: { name: string } | null };
type Bed = Pick<Tables<'beds'>, 'id' | 'length_inches' | 'width_inches'> & { plots?: { locations: { name: string } | null } | null };

type PlantingWithDetails = Planting & {
  crop_varieties: { name: string; latin_name: string; crops: { name: string } | null } | null;
  beds: { id: number; length_inches: number | null; width_inches: number | null; plots: { locations: { name: string } | null } | null } | null;
};

interface PlantingsPageContentProps {
  plantings: PlantingWithDetails[];
  cropVarieties: CropVariety[];
  beds: Bed[];
}

export function PlantingsPageContent({ plantings, cropVarieties, beds }: PlantingsPageContentProps) {
  const [isDialogOpen, setIsDialogOpen] = useState(false);
  const [editing, setEditing] = useState<Planting | null>(null);
  const [deleteId, setDeleteId] = useState<number | null>(null);
  const [deleting, setDeleting] = useState(false);

  const handleEdit = (p: Planting) => {
    setEditing(p);
    setIsDialogOpen(true);
  };
  const handleAdd = () => {
    setEditing(null);
    setIsDialogOpen(true);
  };
  const closeDialog = () => {
    setIsDialogOpen(false);
    setEditing(null);
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

  const statusVariant = (status: Enums<'bed_planting_status'> | null): "default" | "secondary" | "destructive" | "outline" | null | undefined => {
    switch (status) {
      case 'Planted': return 'default';
      case 'Nursery': return 'secondary';
      case 'Harvested': return 'outline';
      default: return 'secondary';
    }
  };

  const getStatusStats = () => {
    const nurseryCount = plantings.filter(p => p.status === 'Nursery').length;
    const plantedCount = plantings.filter(p => p.status === 'Planted').length;
    const harvestedCount = plantings.filter(p => p.status === 'Harvested').length;

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
      <h3 className="text-lg font-semibold mb-2">No plantings yet</h3>
            <p className="text-muted-foreground mb-6 max-w-md mx-auto">
        Start tracking your garden by adding your first planting. Record what you&apos;ve planted, 
        where, and when to keep track of your growing season.
      </p>
      <Button onClick={handleAdd} size="lg">
        <PlusCircle className="h-5 w-5 mr-2" />
        Add Your First Planting
      </Button>
    </div>
  );

  return (
    <div>
      <PageHeader
        title="Plantings"
        action={(
          <Button onClick={handleAdd} size="sm" className="w-full sm:w-auto">
            <PlusCircle className="h-4 w-4 mr-2" />
            Add Planting
          </Button>
        )}
      />

      <FormDialog
        open={isDialogOpen}
        onOpenChange={setIsDialogOpen}
        title={editing ? 'Edit Planting' : 'Add New Planting'}
        description={editing ? 'Update the details of the planting.' : 'Enter the details for the new planting.'}
        submitLabel={editing ? 'Update Planting' : 'Create Planting'}
        formId="plantingFormSubmit"
        className="sm:max-w-md"
      >
        <PlantingForm planting={editing} cropVarieties={cropVarieties} beds={beds} closeDialog={closeDialog} formId="plantingFormSubmit" />
      </FormDialog>

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
                        Bed #{p.beds?.id} ({p.beds?.length_inches ?? '?'}x{p.beds?.width_inches ?? '?'}) @{p.beds?.plots?.locations?.name ?? 'N/A'}
                      </TableCell>
                      <TableCell>{p.planting_type}</TableCell>
                      <TableCell>{p.qty_planting}</TableCell>
                      <TableCell>{p.date_planted}</TableCell>
                      <TableCell>
                        <Badge variant={statusVariant(p.status)}>{p.status}</Badge>
                      </TableCell>
                      <TableCell className="text-right">
                        <Button variant="ghost" size="icon" onClick={() => handleEdit(p)} className="mr-2">
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


