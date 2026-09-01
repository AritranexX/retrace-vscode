export interface Session {
  id: string;
  file_path: string;
  repo_name: string;
  git_branch: string;
  start_time: number;
  duration_seconds: number;
  lines_added: number;
  lines_deleted: number;
  cursor_start_line: number;
  cursor_end_line: number;
  timestamp: number;
}

export interface RepoMetric {
  repo_name: string;
  total_duration: number;
  lines_added: number;
  lines_deleted: number;
  session_count: number;
}
