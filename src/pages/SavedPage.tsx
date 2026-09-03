const SavedPage = () => {
  return (
    <div className="flex-1 bg-white overflow-auto">
      <div className="max-w-5xl mx-auto px-8 py-8">
        <h1 className="text-2xl font-semibold text-gray-900 mb-1">Saved Offers</h1>
        <p className="text-gray-600">Your bookmarked offers.</p>
        <div className="mt-8 text-center text-gray-500">
          No saved offers yet...
        </div>
      </div>
    </div>
  );
};

export default SavedPage;
