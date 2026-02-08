// Search and Filter Functions

function applySortAndFilter() {
    const searchTerm = document.getElementById('studentSearchInput').value.trim().toLowerCase();
    const sortBy = document.getElementById('studentSortSelect').value;

    let filteredStudents = [...allStudentsCache];

    // Apply search filter
    if (searchTerm) {
        filteredStudents = filteredStudents.filter(student => 
            student.name.toLowerCase().includes(searchTerm) || 
            student.code.includes(searchTerm)
        );
    }

    // Apply sorting
    filteredStudents.sort((a, b) => {
        switch(sortBy) {
            case 'name-asc':
                return a.name.localeCompare(b.name, 'ar');
            case 'name-desc':
                return b.name.localeCompare(a.name, 'ar');
            case 'code-asc':
                return a.code.localeCompare(b.code);
            case 'code-desc':
                return b.code.localeCompare(a.code);
            default:
                return 0;
        }
    });

    renderFilteredStudents(filteredStudents);
}
