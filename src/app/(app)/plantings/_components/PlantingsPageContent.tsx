'use client';

import { useState } from 'react';
import type { Tables, Enums } from '@/lib/supabase-server';
import { Button } from "@/components/ui/button";
import { ConfirmDialog } from '@/components/ui/confirm-dialog';
import FormDialog from "@/components/dialogs/FormDialog";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Badge } from "@/components/ui/badge";
import { PlantingForm } from './PlantingForm';
import { deletePlanting } from '../_actions';
import { Pencil, Trash2, PlusCircle } from 'lucide-react';
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

      <PageContent>
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
            {plantings.length === 0 && (
              <TableRow>
                <TableCell colSpan={8} className="text-center">No plantings found.</TableCell>
              </TableRow>
            )}
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
                </TableCell>
              </TableRow>
            ))}
          </TableBody>
        </Table>
      </div>
      </PageContent>
    </div>
  );
}


