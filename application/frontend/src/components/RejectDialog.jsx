import { useEffect, useState } from "react";
import { Dialog, DialogContent, DialogFooter, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";

export const RejectDialog = ({ item, onOpenChange, onConfirm }) => {
  const [note, setNote] = useState("");
  useEffect(() => {
    setNote("");
  }, [item]);
  return (
    <Dialog open={!!item} onOpenChange={onOpenChange}>
      <DialogContent data-testid="reject-dialog">
        <DialogHeader><DialogTitle>Tolak usulan "{item?.title}"</DialogTitle></DialogHeader>
        <Input value={note} onChange={(e) => setNote(e.target.value)} placeholder="Catatan untuk pengusul (opsional)" data-testid="reject-note-input" />
        <DialogFooter>
          <Button variant="outline" onClick={() => onOpenChange(false)}>Batal</Button>
          <Button className="bg-amber-600 hover:bg-amber-700" onClick={() => onConfirm(note)} data-testid="reject-confirm-button">Tolak</Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
};

export const reviewCourse = (api, id, status, review_note = "") => api.patch(`/admin/courses/${id}/review`, { status, review_note });
