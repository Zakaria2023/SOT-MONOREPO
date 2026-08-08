import { getWorkListAction } from "@/app/(dashboard)/work/actions";
import { WorkBoard } from "@/components/work/work-board";

const WorkPage = async () => {
  const items = await getWorkListAction();

  return (
    <div className="flex flex-col gap-5">
      <div className="flex flex-col gap-1">
        <h1 className="font-heading text-2xl">Your work</h1>
        <p className="text-sm text-muted">
          Every job dispatched to you, with the ones nobody has started first.
        </p>
      </div>

      <WorkBoard items={items} />
    </div>
  );
};

export default WorkPage;
