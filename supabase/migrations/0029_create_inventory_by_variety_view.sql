-- Create a view that computes available harvested quantity by crop_variety
drop view if exists inventory_by_variety;
create view inventory_by_variety
as
    with
        harvested
        as
        (
            select p.crop_variety_id, coalesce(sum(pe.qty), 0) as qty_harvested
            from planting_events pe
                join plantings p on p.id = pe.planting_id
            where pe.event_type = 'harvested'
            group by p.crop_variety_id
        )
    select
        cv.id as crop_variety_id,
        coalesce(h.qty_harvested, 0) as qty_harvested,
        coalesce(h.qty_harvested, 0) as qty_available
    from crop_varieties cv
        left join harvested h on h.crop_variety_id = cv.id;
