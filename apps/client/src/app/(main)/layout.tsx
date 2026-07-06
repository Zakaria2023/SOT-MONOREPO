import { Navbar } from "@/components/layout/navbar";
import type { ReactNode } from "react";

type Props = {
  children: ReactNode;
};

const MainLayout = ({ children }: Props) => (
  <>
    <Navbar />
    {children}
  </>
);

export default MainLayout;
