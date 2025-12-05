'use client';

import { useState } from 'react';
import type { Tables } from '@/lib/supabase-server';
import { Button } from '@/components/ui/button';
import {
  Empty,
  EmptyContent,
  EmptyDescription,
  EmptyHeader,
  EmptyMedia,
  EmptyTitle,
} from '@/components/ui/empty';
import { Badge } from '@/components/ui/badge';
import FormDialog from '@/components/dialogs/FormDialog';
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from '@/components/ui/table';
import { CropVarietyForm } from '../_components/CropVarietyForm';
import { deleteCropVariety, type DeleteCropVarietyResult, type Crop } from '../_actions';
import { Pencil, Trash2, Plus, Leaf } from 'lucide-react';
import Image from 'next/image';
import { toast } from 'sonner';
import { ConfirmDialog } from '@/components/ui/confirm-dialog';
import PageHeader from '@/components/page-header';
import PageContent from '@/components/page-content';

type CropVariety = Tables<'crop_varieties'> & { crops?: { name: string } | null } & {
  image_url?: string | null;
};

interface CropVarietiesPageContentProps {
  cropVarieties: CropVariety[];
  crops?: Crop[];
}

export function CropVarietiesPageContent({
  cropVarieties,
  crops = [],
}: CropVarietiesPageContentProps) {
  const [isDialogOpen, setIsDialogOpen] = useState(false);
  const [editingCropVariety, setEditingCropVariety] = useState<CropVariety | null>(null);
  const [deleteId, setDeleteId] = useState<number | null>(null);
  const [deleting, setDeleting] = useState(false);
  const hasVarieties = cropVarieties.length > 0;

  const handleEdit = (cropVariety: CropVariety) => {
    setEditingCropVariety(cropVariety);
    setIsDialogOpen(true);
  };

  const handleAdd = () => {
    setEditingCropVariety(null);
    setIsDialogOpen(true);
  };

  const openDelete = (id: number) => setDeleteId(id);
  const confirmDelete = async () => {
    if (deleteId == null) return;
    try {
      setDeleting(true);
      const result: DeleteCropVarietyResult = await deleteCropVariety(deleteId);
      if (result.message.startsWith('Database Error:')) {
        toast.error(result.message);
      } else {
        toast.success(result.message);
      }
    } catch (error) {
      console.error('Delete Error:', error);
      toast.error('An unexpected error occurred while deleting the crop variety.');
    } finally {
      setDeleting(false);
      setDeleteId(null);
    }
  };

  const closeDialog = () => {
    setIsDialogOpen(false);
    setEditingCropVariety(null);
  };

  const formId = 'crop-variety-form';

  return (
    <div>
      <PageHeader
        title="Crop Varieties"
        action={
          hasVarieties ? (
            <Button onClick={handleAdd} size="sm" className="w-full sm:w-auto">
              <Plus className="h-4 w-4 mr-2" />
              Add Crop Variety
            </Button>
          ) : undefined
        }
      />
      <FormDialog
        open={isDialogOpen}
        onOpenChange={setIsDialogOpen}
        title={editingCropVariety ? 'Edit Crop Variety' : 'Add New Crop Variety'}
        description={
          editingCropVariety
            ? 'Make changes to the crop variety details.'
            : 'Enter the details for the new crop variety.'
        }
        submitLabel={editingCropVariety ? 'Update Crop Variety' : 'Create Crop Variety'}
        formId={formId}
        className="sm:max-w-[425px]"
      >
        <CropVarietyForm
          formId={formId}
          cropVariety={editingCropVariety}
          crops={crops}
          closeDialog={closeDialog}
        />
      </FormDialog>

      <PageContent>
        {!hasVarieties ? (
          <Empty>
            <EmptyHeader>
              <EmptyMedia variant="icon">
                <Leaf className="size-10" />
              </EmptyMedia>
              <EmptyTitle>No crop varieties yet</EmptyTitle>
              <EmptyDescription>
                Add a crop variety to start planning and tracking your crops.
              </EmptyDescription>
            </EmptyHeader>
            <EmptyContent>
              <Button onClick={handleAdd}>
                <Plus className="h-4 w-4 mr-2" />
                Add Crop Variety
              </Button>
            </EmptyContent>
          </Empty>
        ) : (
          <div className="border rounded-lg overflow-hidden">
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Image</TableHead>
                  <TableHead>Crop</TableHead>
                  <TableHead>Variety</TableHead>
                  <TableHead>Latin Name</TableHead>
                  <TableHead>Organic</TableHead>
                  <TableHead>DTM (DS)</TableHead>
                  <TableHead>DTM (TP)</TableHead>
                  <TableHead className="text-right">Actions</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {cropVarieties.map((cropVariety) => (
                  <TableRow key={cropVariety.id}>
                    <TableCell>
                      {cropVariety.image_url ? (
                        <Image
                          src={cropVariety.image_url}
                          alt={`${cropVariety.name} variety image`}
                          width={40}
                          height={40}
                          unoptimized
                          className="h-10 w-10 rounded object-cover border"
                        />
                      ) : (
                        <div className="h-10 w-10 rounded border bg-muted" />
                      )}
                    </TableCell>
                    <TableCell className="font-medium">
                      {cropVariety.crops?.name ?? 'N/A'}
                    </TableCell>
                    <TableCell>{cropVariety.name}</TableCell>
                    <TableCell className="font-serif italic text-muted-foreground text-sm whitespace-nowrap">
                      {cropVariety.latin_name ?? 'N/A'}
                    </TableCell>
                    <TableCell>
                      <Badge variant={cropVariety.is_organic ? 'secondary' : 'outline'}>
                        {cropVariety.is_organic ? 'Yes' : 'No'}
                      </Badge>
                    </TableCell>
                    <TableCell>
                      {cropVariety.dtm_direct_seed_min}-{cropVariety.dtm_direct_seed_max}
                    </TableCell>
                    <TableCell>
                      {cropVariety.dtm_transplant_min}-{cropVariety.dtm_transplant_max}
                    </TableCell>
                    <TableCell className="text-right">
                      <Button
                        variant="ghost"
                        size="icon"
                        onClick={() => handleEdit(cropVariety)}
                        className="mr-2"
                        aria-label={`Edit ${cropVariety.name}`}
                      >
                        <Pencil className="h-4 w-4" />
                      </Button>
                      <Button
                        variant="ghost"
                        size="icon"
                        onClick={() => openDelete(cropVariety.id)}
                        className="text-red-500 hover:text-red-700"
                        aria-label={`Delete ${cropVariety.name}`}
                      >
                        <Trash2 className="h-4 w-4" />
                      </Button>
                    </TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
            <ConfirmDialog
              open={deleteId != null}
              onOpenChange={(open) => {
                if (!open) setDeleteId(null);
              }}
              title="Delete crop variety?"
              description="Deletion will fail if the variety is linked to existing crops."
              confirmText="Delete"
              confirmVariant="destructive"
              confirming={deleting}
              onConfirm={confirmDelete}
            />
          </div>
        )}
      </PageContent>
    </div>
  );
}
