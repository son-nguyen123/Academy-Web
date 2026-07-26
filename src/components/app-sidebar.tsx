"use client"

import * as React from "react"
import Link from "next/link"
import Image from "next/image"
import { usePathname } from "next/navigation"
import {
  ChartNoAxesCombined,
  LayoutDashboard,
  FileText,
  Newspaper,
  Settings,
  Bell,
  GraduationCap,
  Globe2,
  Presentation,
  ShieldCheck,
  School,
  UserRound,
  Users,
} from "lucide-react"

import {
  Sidebar,
  SidebarContent,
  SidebarGroup,
  SidebarGroupContent,
  SidebarGroupLabel,
  SidebarHeader,
  SidebarMenu,
  SidebarMenuButton,
  SidebarMenuItem,
  SidebarFooter,
} from "@/components/ui/sidebar"

const learningNavItems = [
  { name: "Dashboard", path: "/management", icon: LayoutDashboard },
  { name: "Teachers", path: "/management/teachers", icon: UserRound },
  { name: "Classrooms", path: "/management/classrooms", icon: School },
  { name: "Reports & QA", path: "/management/reports", icon: ChartNoAxesCombined },
]

const platformNavItems = [
  { name: "Posts", path: "/management/posts", icon: Newspaper },
  { name: "Sponsors", path: "/management/sponsors", icon: FileText },
  { name: "Notifications", path: "/management/notifications", icon: Bell },
  { name: "Page Settings", path: "/management/settings", icon: Settings },
]

export function AppSidebar() {
  const pathname = usePathname()

  return (
    <Sidebar className="border-r border-slate-200 dark:border-slate-800">
      <SidebarHeader className="p-4 py-6 bg-navy text-white">
        <Image
          src="/logos/aec/aec-logo-reverse-horizontal.png"
          alt="AEC Admin"
          width={160}
          height={45}
          style={{ objectFit: "contain", width: 160, height: 45 }}
          priority
        />
      </SidebarHeader>
      <SidebarContent className="bg-navy text-white">
        <SidebarGroup>
          <SidebarGroupLabel className="text-slate-400">Learning operations</SidebarGroupLabel>
          <SidebarGroupContent>
            <SidebarMenu>
              {learningNavItems.map((item) => {
                const isActive = item.path === "/management" ? pathname === item.path : pathname.startsWith(item.path)
                return (
                  <SidebarMenuItem key={item.name}>
                    <SidebarMenuButton 
                      asChild 
                      isActive={isActive} 
                      className={isActive ? "bg-orange hover:bg-orange-hover text-white font-medium shadow-sm" : "hover:bg-navy-dark text-slate-300 hover:text-white"}
                    >
                      <Link href={item.path}>
                        <item.icon className="mr-2" />
                        <span>{item.name}</span>
                      </Link>
                    </SidebarMenuButton>
                  </SidebarMenuItem>
                )
              })}
            </SidebarMenu>
          </SidebarGroupContent>
        </SidebarGroup>
        <SidebarGroup>
          <SidebarGroupLabel className="text-slate-400">Website management</SidebarGroupLabel>
          <SidebarGroupContent>
            <SidebarMenu>
              {platformNavItems.map((item) => {
                const isActive = pathname === item.path || pathname.startsWith(`${item.path}/`)
                return (
                  <SidebarMenuItem key={item.name}>
                    <SidebarMenuButton
                      asChild
                      isActive={isActive}
                      className={isActive ? "bg-orange hover:bg-orange-hover text-white font-medium shadow-sm" : "hover:bg-navy-dark text-slate-300 hover:text-white"}
                    >
                      <Link href={item.path}>
                        <item.icon className="mr-2" />
                        <span>{item.name}</span>
                      </Link>
                    </SidebarMenuButton>
                  </SidebarMenuItem>
                )
              })}
            </SidebarMenu>
          </SidebarGroupContent>
        </SidebarGroup>
      </SidebarContent>
      <SidebarFooter className="bg-navy p-4 text-white">
        <SidebarMenu>
          {process.env.NODE_ENV !== "production" ? (
            <>
              <SidebarMenuItem>
                <SidebarMenuButton className="bg-indigo-500/20 text-indigo-100 hover:bg-indigo-500/25">
                  <ShieldCheck className="mr-2" /><span>Admin</span>
                </SidebarMenuButton>
              </SidebarMenuItem>
              <SidebarMenuItem>
                <SidebarMenuButton asChild className="hover:bg-navy-dark text-slate-300 hover:text-white">
                  <Link href="/api/elearning/demo-role?role=TEACHER"><Presentation className="mr-2" /><span>View Teacher</span></Link>
                </SidebarMenuButton>
              </SidebarMenuItem>
              <SidebarMenuItem>
                <SidebarMenuButton asChild className="hover:bg-navy-dark text-slate-300 hover:text-white">
                  <Link href="/api/elearning/demo-role?role=STUDENT"><GraduationCap className="mr-2" /><span>View Student</span></Link>
                </SidebarMenuButton>
              </SidebarMenuItem>
            </>
          ) : null}
          <SidebarMenuItem>
            <SidebarMenuButton asChild className="hover:bg-navy-dark text-slate-300 hover:text-white">
              <Link href="/management/accounts"><Users className="mr-2" /><span>Accounts</span></Link>
            </SidebarMenuButton>
          </SidebarMenuItem>
          <SidebarMenuItem>
            <SidebarMenuButton asChild className="hover:bg-navy-dark text-slate-300 hover:text-white">
              <Link href="/"><Globe2 className="mr-2" /><span>Public website</span></Link>
            </SidebarMenuButton>
          </SidebarMenuItem>
        </SidebarMenu>
      </SidebarFooter>
    </Sidebar>
  )
}
